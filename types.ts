
export interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  size: number;
}

export interface ProcessingLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  embeddingModel: string;
  persona?: string; // Custom System Instruction / Role
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export enum AppMode {
  DASHBOARD = 'DASHBOARD',
  SETTINGS = 'SETTINGS'
}

// --- CODEWIKI INTELLIGENCE TYPES (UPDATED FOR GRAPHRAG) ---

export type SymbolKind = 'class' | 'function' | 'variable' | 'interface' | 'endpoint' | 'database_table' | 'import' | 'method';

export interface SymbolRelationships {
  calledBy: string[]; // List of Symbol IDs that call this symbol
  calls: string[];    // List of Symbol IDs called by this symbol
  inheritsFrom?: string[];
  implementedIn?: string[];
}

export interface CodeSymbol {
  id: string;          // Unique Global ID (e.g., "src/services/auth.ts:loginUser")
  name: string;        // Display Name (e.g., "loginUser")
  kind: SymbolKind;
  filePath: string;
  line: number;
  scope: string;       // 'global', 'class:UserService', 'function:init'
  codeSnippet: string; 
  docString?: string;  
  
  // GraphRAG Data
  relationships: SymbolRelationships;
  complexityScore: number; // Cyclomatic Complexity
  
  // New: Unit Tests & Examples
  relatedTests?: string[]; // IDs of test functions that test this symbol
}

export interface ReferenceLocation {
  filePath: string;
  line: number;
  snippet: string;
}

// --- ARCHITECTURE & BUSINESS TYPES ---

export interface ArchViolation {
  id: string;
  filePath: string;
  rule: string;
  description: string;
  severity: 'critical' | 'warning';
}

export interface BusinessRule {
  id: string;
  filePath: string;
  condition: string; // "If User is VIP"
  outcome: string;   // "Shipping is free"
  rawSnippet: string;
}

// --- SMART AUDIT TYPES ---
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssueCategory = 'security' | 'performance' | 'bug' | 'best_practice';

export interface CodeIssue {
  id: string;
  filePath: string;
  line: number; // Approximate line number
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  suggestion: string; // Proposed fix
}

export interface FileMetadata {
  path: string;
  language: string;
  contentHash: string; // MD5/SHA hash for Incremental Indexing
  lastProcessed: number;
  symbols: CodeSymbol[]; 
  dependencies: string[]; // List of imported file paths
  externalDependencies?: string[]; // npm/pip packages
  isDbSchema: boolean;
  isInfra: boolean;
  isTestFile?: boolean;
  apiEndpoints: string[];
  
  // New Insights
  archViolations: ArchViolation[];
  businessRules: BusinessRule[];
  isZombie: boolean; // True if no symbols are called by others (Dead Code)

  // --- METRICS ---
  metrics?: {
      complexity: number;    // Total Cyclomatic Complexity
      commentRatio: number;  // Percentage of comment lines
      maintainability: number; // Maintainability Index (0-100)
  };

  // --- AUDIT ---
  issues?: CodeIssue[];

  // Virtual Document Flags (For RAG Feedback Loop)
  isVirtual?: boolean; 
  docSection?: string; // e.g., 'architecture', 'code_analysis'
}

export interface KnowledgeGraph {
  nodes: Record<string, FileMetadata>; // Map filePath -> Metadata
  symbolTable: Record<string, CodeSymbol>; // Map symbolId -> Symbol Data
  nameIndex: Record<string, string[]>; // Map simpleName ("User") -> [IDs...] (handle collisions)
}

// --- RAG & SEARCH TYPES ---

export interface VectorDocument {
  id: string;
  content: string;
  metadata: {
    filePath: string;
    startLine?: number;
    endLine?: number;
    symbolId?: string; // Link to specific symbol in Graph
    relatedSymbols?: string[]; // IDs of related symbols (GraphRAG injection)
    isVirtual?: boolean;
  };
  embedding?: number[];
  tokens?: Set<string>; 
}

export interface SearchResult {
  doc: VectorDocument;
  score: number;
  matchType: 'vector' | 'keyword' | 'hybrid';
}

export interface ProcessedFile {
  path: string;
  content: string;
  size: number;
  lines: number;
  metadata: FileMetadata;
  isCached?: boolean; // Flag to skip processing
}

// Wiki Features
export interface ManualOverride {
  sectionId: string;
  content: string;
  updatedAt: number;
}
