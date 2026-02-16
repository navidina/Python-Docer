
import { FileMetadata, CodeSymbol, SymbolKind, ProcessedFile, SymbolRelationships, ArchViolation } from '../types';
import { ARCH_RULES } from '../utils/constants';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

/**
 * RAYAN SEMANTIC ENGINE (v3.2 - Schema Detection)
 * Improved graph generation to strictly follow 'imports' and 'usage'.
 */

export const generateContentHash = async (content: string): Promise<string> => {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) + content.charCodeAt(i);
  }
  return hash.toString(16);
};

const calculateCyclomaticComplexity = (code: string): number => {
  let score = 1;
  const branchingPatterns = [
    /\bif\b/g, /\belse\b/g, /\bfor\b/g, /\bwhile\b/g, 
    /\bcase\b/g, /\bcatch\b/g, /\?.*:/g, /&&/g, /\|\|/g
  ];
  branchingPatterns.forEach(p => {
    const matches = code.match(p);
    if (matches) score += matches.length;
  });
  return score;
};

// Helper: Calculate comment ratio
const calculateCommentRatio = (content: string): number => {
    const lines = content.split('\n');
    if (lines.length === 0) return 0;
    
    // Simple heuristic for JS/TS/C-like languages and Python/Shell
    const commentLines = lines.filter(l => {
        const trimmed = l.trim();
        return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('#');
    }).length;
    
    return Math.round((commentLines / lines.length) * 100);
};

// --- SMART PATH RESOLVER (Handles Aliases) ---
const resolveImportPath = (currentFilePath: string, importPath: string, allFiles: Set<string>): string | null => {
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '/index.ts', '/index.tsx', '/index.js'];
    
    // 1. Handle Relative Paths
    if (importPath.startsWith('.')) {
        const currentParts = currentFilePath.split('/');
        currentParts.pop(); // Remove filename
        
        const importParts = importPath.split('/');
        for (const part of importParts) {
            if (part === '.') continue;
            if (part === '..') currentParts.pop();
            else currentParts.push(part);
        }
        
        const resolvedPathBase = currentParts.join('/');
        for (const ext of extensions) {
            const candidate = resolvedPathBase + ext;
            if (allFiles.has(candidate)) return candidate;
        }
    } 
    // 2. Handle Absolute/Alias Paths (e.g., "@/components/Button", "src/utils")
    else {
        // Heuristic: Try to find the file by stripping common alias prefixes
        const cleanPath = importPath
            .replace(/^@\//, '')   // Remove @/
            .replace(/^~\//, '')   // Remove ~/
            .replace(/^src\//, ''); // Remove src/ to try matching relative to root

        // Potential search paths
        const candidatesBase = [
            importPath,                 // As is (e.g., "components/Button")
            `src/${cleanPath}`,         // In src (e.g., "src/components/Button")
            cleanPath                   // Cleaned (e.g., "components/Button")
        ];

        for (const base of candidatesBase) {
            for (const ext of extensions) {
                const candidate = base + ext;
                // Check if this path exists in our file list
                // We also check with leading slash removal just in case
                if (allFiles.has(candidate)) return candidate;
                if (allFiles.has(candidate.startsWith('/') ? candidate.substring(1) : candidate)) return candidate;
            }
        }
    }
    
    return null;
};

// --- CONTEXT OPTIMIZER (STRIP BODIES) ---
/**
 * Reduces code to just signatures (imports, class/func headers) to fit more in context window.
 * Critical for generating accurate diagrams across multiple files.
 */
export const stripFunctionBodies = (content: string, aggressive: boolean = false): string => {
    const lines = content.split('\n');
    let output = [];
    let insideBody = false;
    let bracketCount = 0;

    // Regexes to keep important lines
    const keepPatterns = [
        /^export /, /^class /, /^interface /, /^type /, /^function /, 
        /@/, // Decorators
        /constructor/, 
        /^[a-zA-Z0-9_]+\s*[:=]\s*(\(|async)/, // Methods/Properties
        /^\s*[a-zA-Z0-9_]+\(.*\)/, // Method signatures
        /^model\s/, /^entity\s/ // DB Models (Prisma/TypeORM)
    ];

    // In non-aggressive mode, we keep imports. In aggressive mode, we assume imports are noise for ERD/Class diagrams
    if (!aggressive) {
        keepPatterns.unshift(/^import /);
        keepPatterns.unshift(/^require\(/);
    }

    for (let line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Remove comments in aggressive mode
        if (aggressive && (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*'))) continue;
        
        // Always keep definitions and key structural lines
        if (keepPatterns.some(p => p.test(trimmed))) {
            output.push(line);
            continue;
        }

        // Remove private/protected members in aggressive mode to save space (focus on public API)
        if (aggressive && (trimmed.startsWith('private') || trimmed.startsWith('protected'))) continue;

        // Extremely simple bracket counting to detect if we are inside a function body
        // This is not a full parser, but good enough for context reduction
        const open = (line.match(/\{/g) || []).length;
        const close = (line.match(/\}/g) || []).length;

        if (open > 0 && !insideBody) {
             // Line has an opening brace, keep it but mark body start
             output.push(line); 
        } else if (close > 0 && bracketCount - close <= 0) {
            // Closing a major block
            output.push(line); 
        } else if (bracketCount === 0 && trimmed.length > 0) {
            // Top level stuff (likely variables or properties)
            // In aggressive mode, restrict top level to only fields (lines with colons or equals)
            if (!aggressive || (trimmed.includes(':') || trimmed.includes('='))) {
                output.push(line);
            }
        }

        bracketCount += open - close;
        if (bracketCount < 0) bracketCount = 0;

        insideBody = bracketCount > 0;
    }
    
    // Fallback: If stripping failed (too small), return truncated raw content
    if (output.length < 3) return content.substring(0, 1000);

    return output.join('\n');
};


// --- AST PARSER FOR JS/TS ---

class AstParser {
  private symbols: CodeSymbol[] = [];
  private filePath: string;
  public importsMap: Record<string, string> = {}; 
  private dependencies: Set<string> = new Set();
  private externalDependencies: Set<string> = new Set();
  private content: string;
  private lines: string[];
  private containsSchemaDefinition: boolean = false;

  constructor(content: string, filePath: string) {
    this.content = content;
    this.filePath = filePath;
    this.lines = content.split('\n');
  }

  private generateId(name: string, scope: string): string {
    const scopeStr = scope.replace(/[:\s]/g, '_');
    return `${this.filePath}:${scopeStr}:${name}`;
  }

  public parse(): FileMetadata {
    this.extractImportsRegex();
    this.detectSchemaSignatures();

    if (this.filePath.match(/\.(js|jsx|ts|tsx|mjs)$/)) {
        this.parseJsLike();
    } else {
        this.parseLegacy();
    }

    return this.buildMetadata();
  }

  private detectSchemaSignatures() {
      const schemaPatterns = [
          /@Entity\(/,                 
          /model\s+[A-Z][a-zA-Z0-9_]*\s*\{/, 
          /new\s+Schema\(/,            
          /interface\s+I?[A-Z][a-zA-Z0-9_]*(DTO|Model|Schema|Entity)/i, 
          /class\s+[A-Z][a-zA-Z0-9_]*\s+extends\s+(Model|Entity|BaseEntity)/, 
          /type\s+[A-Z][a-zA-Z0-9_]*\s*=\s*\{/, 
          /message\s+[A-Z][a-zA-Z0-9_]*\s*\{/   
      ];
      
      this.containsSchemaDefinition = schemaPatterns.some(p => p.test(this.content));
      if (this.filePath.match(/(schema|entity|model|dto|proto)/i)) {
          this.containsSchemaDefinition = true;
      }
  }

  private extractImportsRegex() {
      // 1. Static Imports
      const importPattern = /import\s+(?:\{([^}]+)\}|(\*\s+as\s+\w+)|(\w+))?\s*from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importPattern.exec(this.content)) !== null) {
          const source = match[4];
          this.dependencies.add(source); // Treat all as dependencies first, resolve later

          if (match[1]) { 
              match[1].split(',').forEach(i => {
                  const parts = i.trim().split(/\s+as\s+/);
                  const localName = parts.length > 1 ? parts[1] : parts[0];
                  this.importsMap[localName] = source;
              });
          } else if (match[2]) { 
              const localName = match[2].split(/\s+as\s+/)[1];
              this.importsMap[localName] = source;
          } else if (match[3]) { 
              this.importsMap[match[3]] = source;
          }
      }
      
      // 2. Dynamic Imports / Require
      const dynamicImportPattern = /(?:import|require)\(['"]([^'"]+)['"]\)/g;
      while ((match = dynamicImportPattern.exec(this.content)) !== null) {
          const source = match[1];
          this.dependencies.add(source);
          // For dynamic imports, we can't easily map to a variable name without AST,
          // but we capture the dependency.
      }
  }

  private parseJsLike() {
      const defPatterns = [
          /(?:export\s+)?(?:default\s+)?class\s+([A-Z][a-zA-Z0-9_]*)/g, 
          /(?:export\s+)?(?:default\s+)?function\s+([a-zA-Z0-9_]+)/g, 
          /(?:export\s+)?(?:const|let|var)\s+([A-Z][a-zA-Z0-9_]*)\s*=\s*(?:\(|async|function|new|class)/g, // Caught classes/funcs assigned to vars
          /(?:export\s+)?(?:const|let|var)\s+([a-z][a-zA-Z0-9_]*)\s*=\s*(?:\(|async|function|\(.*\)\s*=>)/g, // Arrow funcs
          /(?:export\s+)?(?:interface|type)\s+([A-Z][a-zA-Z0-9_]*)/g 
      ];

      defPatterns.forEach((pattern) => {
          let match;
          while ((match = pattern.exec(this.content)) !== null) {
              const name = match[1];
              if (!name) continue;

              let kind: SymbolKind = 'function';
              if (pattern.source.includes('class')) kind = 'class';
              else if (pattern.source.includes('interface')) kind = 'interface';
              else if (name[0] === name[0].toUpperCase()) kind = 'class'; 

              const line = this.content.substring(0, match.index).split('\n').length;
              const snippet = this.content.substring(match.index, Math.min(this.content.length, match.index + 300));

              this.addSymbol(name, kind, line, 'global', snippet);
          }
      });
  }

  private parseLegacy(): void {
    const patterns = {
        class: [
            /(?:class|struct|interface|type)\s+([a-zA-Z0-9_]+)/,
            /public\s+(?:class|interface)\s+([a-zA-Z0-9_]+)/ 
        ],
        function: [
            /(?:function|def|func|fn)\s+([a-zA-Z0-9_]+)/,
            /(?:public|private|protected|static)\s+[\w<>[\]]+\s+([a-zA-Z0-9_]+)\s*\(/ 
        ]
    };
    
    this.lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('#')) return;

        for (const regex of patterns.class) {
            const match = regex.exec(trimmed);
            if (match) {
                this.addSymbol(match[1], 'class', idx + 1, 'global', trimmed);
                break;
            }
        }
        for (const regex of patterns.function) {
            const match = regex.exec(trimmed);
            if (match) {
                this.addSymbol(match[1], 'function', idx + 1, 'global', trimmed);
                break;
            }
        }
    });
  }

  private addSymbol(name: string, kind: SymbolKind, line: number, scope: string, codeSnippet: string) {
    if (this.symbols.some(s => s.name === name)) return;

    this.symbols.push({
      id: this.generateId(name, scope),
      name: name,
      kind,
      filePath: this.filePath,
      line,
      scope,
      codeSnippet,
      relationships: { calledBy: [], calls: [] },
      complexityScore: calculateCyclomaticComplexity(codeSnippet)
    });
  }

  private buildMetadata(): FileMetadata {
    const isTest = this.filePath.includes('.test.') || this.filePath.includes('.spec.') || this.filePath.includes('_test');
    
    const totalComplexity = this.symbols.reduce((sum, sym) => sum + (sym.complexityScore || 1), 0);
    const commentRatio = calculateCommentRatio(this.content);
    
    let maintainability = 100 - (totalComplexity * 0.1) + (commentRatio * 0.5); 
    maintainability = Math.max(0, Math.min(100, maintainability));

    return {
      path: this.filePath,
      language: this.filePath.split('.').pop() || '',
      contentHash: '',
      lastProcessed: Date.now(),
      symbols: this.symbols,
      dependencies: Array.from(this.dependencies),
      externalDependencies: Array.from(this.externalDependencies),
      apiEndpoints: [],
      isDbSchema: this.containsSchemaDefinition,
      isInfra: false,
      isTestFile: isTest,
      archViolations: [],
      businessRules: [],
      isZombie: false,
      // @ts-ignore
      importsMap: this.importsMap,
      
      metrics: {
          complexity: totalComplexity,
          commentRatio: commentRatio,
          maintainability: Math.round(maintainability)
      }
    };
  }
}

// Generate a simplified dependency graph for LLM consumption
export const generateDependencyMap = (files: ProcessedFile[]) => {
    const map: Record<string, string[]> = {};
    const allFilePaths = new Set(files.map(f => f.path));

    files.forEach(file => {
        const deps: string[] = [];
        file.metadata.dependencies.forEach(d => {
            const resolved = resolveImportPath(file.path, d, allFilePaths);
            if (resolved) deps.push(resolved);
        });
        if (deps.length > 0) {
            map[file.path] = deps;
        }
    });
    return map;
};

export const buildGraph = (files: ProcessedFile[]): { symbolTable: Record<string, CodeSymbol>, nameIndex: Record<string, string[]> } => {
  const symbolTable: Record<string, CodeSymbol> = {};
  const nameIndex: Record<string, string[]> = {};
  
  const allFilePaths = new Set(files.map(f => f.path));

  // 1. Build Symbol Index
  const fileMap: Record<string, ProcessedFile> = {};
  files.forEach(file => {
    fileMap[file.path] = file;
    
    // Ensure every file has at least one symbol node to represent the FILE itself if no classes found
    if (file.metadata.symbols.length === 0) {
        const fileSym: CodeSymbol = {
            id: `${file.path}:FILE`,
            name: file.path.split('/').pop() || 'File',
            kind: 'import', // Generic kind
            filePath: file.path,
            line: 0,
            scope: 'global',
            codeSnippet: '',
            relationships: { calledBy: [], calls: [] },
            complexityScore: 0
        };
        file.metadata.symbols.push(fileSym);
    }

    file.metadata.symbols.forEach(sym => {
      symbolTable[sym.id] = sym;
      if (!nameIndex[sym.name]) nameIndex[sym.name] = [];
      nameIndex[sym.name].push(sym.id);
    });
  });

  // 2. Resolve Links (Improved Logic)
  files.forEach(sourceFile => {
    const importsMap = (sourceFile.metadata as any).importsMap || {};
    const dependencies = sourceFile.metadata.dependencies || [];
    
    // Strategy A: Explicit Imports (Strongest Link)
    // We iterate through ALL dependencies found in the file, even if we didn't find specific symbol usage.
    // This solves the "Props Drilling" or "Passthrough" issue where usage isn't detected.
    dependencies.forEach(depPath => {
        const resolvedPath = resolveImportPath(sourceFile.path, depPath, allFilePaths);
        
        if (resolvedPath && fileMap[resolvedPath]) {
            const targetFile = fileMap[resolvedPath];
            // Link SourceFile -> TargetFile (using their first/main symbols)
            const sourceSym = sourceFile.metadata.symbols[0];
            const targetSym = targetFile.metadata.symbols[0]; // Usually the default export or first class

            if (sourceSym && targetSym && sourceSym.id !== targetSym.id) {
                if (!sourceSym.relationships.calls.includes(targetSym.id)) {
                    sourceSym.relationships.calls.push(targetSym.id);
                    targetSym.relationships.calledBy.push(sourceSym.id);
                }
            }
        }
    });

    // Strategy C: Component Detection (JSX)
    const content = sourceFile.content;
    const jsxMatches = content.matchAll(/<([A-Z][a-zA-Z0-9_]*)/g);
    for (const match of jsxMatches) {
        const componentName = match[1];
        // If not imported explicitly, try to find global component by name (e.g. Next.js auto-imports or simple match)
        if (!importsMap[componentName]) {
             if (nameIndex[componentName]) {
                 const possibleTargets = nameIndex[componentName];
                 // Ambiguity check: if only 1 exists, assume it's that one
                 if (possibleTargets.length === 1) {
                     const targetId = possibleTargets[0];
                     const sourceSym = sourceFile.metadata.symbols[0];
                     if (sourceSym && targetId !== sourceSym.id) {
                         if (!sourceSym.relationships.calls.includes(targetId)) {
                             sourceSym.relationships.calls.push(targetId);
                             const targetSym = symbolTable[targetId];
                             if (targetSym) targetSym.relationships.calledBy.push(sourceSym.id);
                         }
                     }
                 }
             }
        }
    }
    
    // Architecture Rules Check
    sourceFile.metadata.archViolations = [];
    ARCH_RULES.forEach(rule => {
        if (rule.pattern.source.test(sourceFile.path)) {
            // Check resolved dependencies for violations
            dependencies.forEach(dep => {
                // We check the raw dependency string against the rule target
                if (rule.pattern.target.test(dep)) {
                    sourceFile.metadata.archViolations.push({
                        id: `arch-${Math.random().toString(36).substr(2, 9)}`,
                        filePath: sourceFile.path,
                        rule: rule.name,
                        description: rule.message,
                        severity: rule.severity as 'critical' | 'warning'
                    });
                }
            });
        }
    });

    const isMainEntry = ['index', 'main', 'app', 'server', 'layout', 'page'].some(n => sourceFile.path.toLowerCase().includes(n));
    if (!isMainEntry && sourceFile.metadata.symbols.length > 0 && !sourceFile.metadata.isTestFile) {
        const hasIncomingRefs = sourceFile.metadata.symbols.some(s => s.relationships.calledBy.length > 0);
        if (!hasIncomingRefs) {
            sourceFile.metadata.isZombie = true;
        }
    }
  });

  return { symbolTable, nameIndex };
};

export const extractFileMetadata = async (content: string, path: string): Promise<FileMetadata> => {
  try {
    const parser = new AstParser(content, path);
    const metadata = parser.parse();
    metadata.contentHash = await generateContentHash(content);
    return metadata;
  } catch (e) {
    console.warn(`Semantic Parser failed for ${path}`, e);
    return {
      path,
      language: 'text',
      contentHash: '',
      lastProcessed: Date.now(),
      symbols: [],
      dependencies: [],
      apiEndpoints: [],
      isDbSchema: false,
      isInfra: false,
      archViolations: [],
      businessRules: [],
      isZombie: false
    };
  }
};
