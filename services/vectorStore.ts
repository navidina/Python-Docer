
import { VectorDocument, OllamaConfig, SearchResult, ProcessedFile } from '../types';
import { generateEmbeddings } from './ollamaService';
import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'rayan-vector-store';
const STORE_NAME = 'vectors';

/**
 * A persistent Vector Store for RAG, powered by IndexedDB.
 * This ensures "CodeWiki" scalability, allowing 100MB+ repositories without RAM exhaustion.
 */
export class LocalVectorStore {
  private config: OllamaConfig;
  private dbPromise: Promise<IDBPDatabase>;
  private memoryCache: VectorDocument[] = []; 

  constructor(config: OllamaConfig) {
    this.config = config;
    this.dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('filePath', 'metadata.filePath', { unique: false });
        }
      },
    });
    this.loadCache();
  }

  private async loadCache() {
    try {
      const db = await this.dbPromise;
      this.memoryCache = await db.getAll(STORE_NAME, undefined, 500);
    } catch (e) {
      console.warn("Failed to load initial vector cache", e);
    }
  }

  private tokenize(text: string): Set<string> {
    const tokens = text.toLowerCase().split(/[^a-z0-9_]+/);
    return new Set(tokens.filter(t => t.length > 2));
  }

  private splitText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += chunkSize - overlap;
    }
    return chunks;
  }

  /**
   * Adds processed files to the persistent store.
   * FIX: Opens short-lived transactions per document write to avoid TransactionInactiveError 
   * caused by long-running embedding API calls.
   */
  async addDocuments(files: ProcessedFile[], onProgress?: (current: number, total: number) => void): Promise<void> {
    const db = await this.dbPromise;
    let processedCount = 0;
    const totalFiles = files.length;

    for (const file of files) {
      const rawChunks = this.splitText(file.content);
      
      for (let i = 0; i < rawChunks.length; i++) {
        const chunk = rawChunks[i];
        
        // Validation: Skip empty chunks to prevent 400 errors from API
        if (!chunk || chunk.trim().length === 0) continue;

        const docId = `${file.path}-${i}`;
        
        // Check if exists first (ReadOnly transaction)
        const existing = await db.get(STORE_NAME, docId);
        if (existing) continue;

        const tokens = this.tokenize(chunk);

        // Link Graph data
        const presentSymbols = file.metadata.symbols.filter(s => chunk.includes(s.name));
        const relatedSymbolIds = presentSymbols.map(s => s.id);
        
        presentSymbols.forEach(s => {
            if (s.relationships?.calledBy) {
                relatedSymbolIds.push(...s.relationships.calledBy);
            }
        });

        try {
          // 1. Long-running async call (Wait for Ollama)
          const embedding = await generateEmbeddings(this.config, chunk);
          
          if (!embedding || embedding.length === 0) {
             console.warn(`Skipping empty embedding for chunk ${i} of ${file.path}`);
             continue;
          }
          
          const doc: VectorDocument = {
            id: docId,
            content: chunk,
            metadata: {
              filePath: file.path,
              startLine: i * 50,
              relatedSymbols: relatedSymbolIds
            },
            embedding: embedding,
            tokens: tokens
          };

          // 2. Open a fresh short-lived transaction ONLY for the write operation
          const tx = db.transaction(STORE_NAME, 'readwrite');
          await tx.objectStore(STORE_NAME).put(doc);
          await tx.done;

          if (this.memoryCache.length < 1000) this.memoryCache.push(doc);

        } catch (e) {
          console.error(`Failed to index chunk ${i} for ${file.path}:`, e);
        }
      }
      processedCount++;
      if (onProgress) onProgress(processedCount, totalFiles);
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  async similaritySearch(query: string, k: number = 4): Promise<VectorDocument[]> {
    const db = await this.dbPromise;
    // Note: For massive DBs, use a better retrieval strategy (e.g., keyword filtering before vector scoring)
    const allDocs = await db.getAll(STORE_NAME);

    if (allDocs.length === 0) return [];

    const queryEmbedding = await generateEmbeddings(this.config, query);
    const queryTokens = this.tokenize(query);
    
    const results: SearchResult[] = allDocs.map(doc => {
      let vectorScore = 0;
      if (doc.embedding) {
        vectorScore = this.cosineSimilarity(queryEmbedding, doc.embedding);
      }
      let keywordMatches = 0;
      
      // Handle cases where tokens might not be a Set after being retrieved from IDB
      const docTokens = doc.tokens instanceof Set ? doc.tokens : new Set(Array.from(doc.tokens || []));
      
      queryTokens.forEach(token => {
        if (docTokens.has(token)) keywordMatches++;
      });
      const keywordScore = queryTokens.size > 0 ? keywordMatches / queryTokens.size : 0;
      
      // Weighting: 70% Vector, 30% Keyword
      const finalScore = (vectorScore * 0.7) + (keywordScore * 0.3);

      return { doc, score: finalScore, matchType: keywordScore > 0.5 ? 'keyword' : 'vector' };
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k).map(r => r.doc);
  }
}
