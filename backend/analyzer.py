import os
import json
import re
import networkx as nx

# Safe import for tree-sitter to prevent server crash
try:
    from tree_sitter import Parser
    from tree_sitter_languages import get_language, get_parser
    TREE_SITTER_AVAILABLE = True
except (ImportError, OSError, Exception) as e:
    print(f"⚠️ Tree-Sitter Warning: Could not load parsing libraries ({e}). Switching to shallow analysis.")
    TREE_SITTER_AVAILABLE = False

# Map file extensions to Tree-sitter languages
LANGUAGE_MAP = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust'
}

# Queries to extract imports and class definitions
QUERIES = {
    'typescript': """
        (import_statement source: (string) @import_path)
        (class_declaration name: (type_identifier) @class_name)
        (interface_declaration name: (type_identifier) @interface_name)
        (function_declaration name: (identifier) @func_name)
        (type_alias_declaration name: (type_identifier) @type_name)
    """,
    'javascript': """
        (import_statement source: (string) @import_path)
        (class_declaration name: (identifier) @class_name)
        (function_declaration name: (identifier) @func_name)
    """,
    'python': """
        (import_from_statement module_name: (dotted_name) @import_path)
        (import_statement name: (dotted_name) @import_path)
        (class_definition name: (identifier) @class_name)
        (function_definition name: (identifier) @func_name)
    """,
}

class RepoAnalyzer:
    def __init__(self, repo_path: str):
        self.repo_path = repo_path
        self.graph = nx.DiGraph()
        self.file_map = {}
        self.tree_structure = ""
        self.parsers = {} 
        self.symbol_table = {}
        
        # TSConfig Alias Settings
        self.tsconfig_paths = {}
        self.tsconfig_base_url = "."
        self._load_tsconfig()

    def _get_parser_for_file(self, filename):
        if not TREE_SITTER_AVAILABLE:
            return None, None

        ext = os.path.splitext(filename)[1]
        lang_name = LANGUAGE_MAP.get(ext)
        if not lang_name: return None, None
            
        if lang_name not in self.parsers:
            try:
                # Use get_parser/get_language from tree_sitter_languages wrapper
                self.parsers[lang_name] = {
                    'parser': get_parser(lang_name),
                    'language': get_language(lang_name)
                }
            except Exception as e:
                print(f"Parser Error {lang_name}: {e}")
                return None, None
        return self.parsers[lang_name]['parser'], self.parsers[lang_name]['language']

    def _load_tsconfig(self):
        """Parse tsconfig.json to understand path aliases (e.g. @/...)"""
        tsconfig_path = os.path.join(self.repo_path, 'tsconfig.json')
        if os.path.exists(tsconfig_path):
            try:
                with open(tsconfig_path, 'r', encoding='utf-8') as f:
                    # Remove comments (// or /* */) as standard JSON doesn't support them
                    content = re.sub(r'//.*', '', f.read())
                    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
                    data = json.loads(content)
                    
                    compiler_opts = data.get('compilerOptions', {})
                    self.tsconfig_base_url = compiler_opts.get('baseUrl', '.')
                    self.tsconfig_paths = compiler_opts.get('paths', {})
                    # print(f"Loaded tsconfig paths: {list(self.tsconfig_paths.keys())}")
            except Exception as e:
                print(f"Error parsing tsconfig.json: {e}")

    def _resolve_import_path(self, current_file_rel_path: str, import_str: str) -> str:
        """Resolves an import string (e.g., '@/utils') to a real file path."""
        
        # 1. Handle Aliases (e.g., @/components/...)
        resolved_path = import_str
        for alias, targets in self.tsconfig_paths.items():
            alias_prefix = alias.replace('*', '')
            if import_str.startswith(alias_prefix):
                # Assume first target is correct for now
                if targets:
                    target_prefix = targets[0].replace('*', '')
                    # Combine: baseUrl + target + rest of path
                    resolved_path = os.path.join(self.tsconfig_base_url, target_prefix, import_str[len(alias_prefix):])
                    break
        
        # 2. Handle Relative Paths (./ or ../)
        if import_str.startswith('.'):
            current_dir = os.path.dirname(current_file_rel_path)
            resolved_path = os.path.normpath(os.path.join(current_dir, import_str))

        # 3. Normalize Path
        resolved_path = resolved_path.replace('\\', '/')
        if resolved_path.startswith('/'): resolved_path = resolved_path[1:]

        # 4. Find Physical File (Append extensions or index)
        possible_extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '']
        
        for ext in possible_extensions:
            candidate = resolved_path + ext
            # Check in scanned map
            if candidate in self.file_map:
                return candidate
            
            # Check on disk (if not yet mapped/scanned but exists)
            abs_path = os.path.join(self.repo_path, candidate)
            if os.path.exists(abs_path) and os.path.isfile(abs_path):
                return candidate

        return None

    def analyze(self):
        file_tree = []
        if not os.path.exists(self.repo_path): return

        # Pass 1: Scan and load all files
        for root, dirs, files in os.walk(self.repo_path):
            dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', 'dist', 'build', '__pycache__', '.next']]
            
            for file in files:
                if file.endswith(tuple(LANGUAGE_MAP.keys())) or file.endswith(('.json', '.md', '.txt')):
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, self.repo_path).replace('\\', '/')
                    
                    try:
                        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            self.file_map[rel_path] = content
                            self.graph.add_node(rel_path, type='file', size=len(content))
                            file_tree.append(rel_path)
                    except: pass

        self.tree_structure = "\n".join(file_tree[:500])

        # Pass 2: Analyze Dependencies (Now that file_map is populated)
        print("Parsing dependencies with Alias resolution...")
        for rel_path, content in self.file_map.items():
            if rel_path.endswith(tuple(LANGUAGE_MAP.keys())):
                self._parse_dependencies(rel_path, content, rel_path)

    def _parse_dependencies(self, rel_path, content, filename):
        if not TREE_SITTER_AVAILABLE: return

        parser, language = self._get_parser_for_file(filename)
        if not parser: return

        try:
            tree = parser.parse(bytes(content, "utf8"))
            ext = os.path.splitext(filename)[1]
            lang_name = LANGUAGE_MAP.get(ext)
            query_scm = QUERIES.get(lang_name)
            if not query_scm: return

            query = language.query(query_scm)
            captures = query.captures(tree.root_node)

            for node, tag in captures:
                text = content[node.start_byte:node.end_byte].strip('"\'')
                
                if tag == 'import_path':
                    # Resolve real file path
                    resolved_file = self._resolve_import_path(rel_path, text)
                    if resolved_file:
                        # Link current file to imported file
                        self.graph.add_edge(rel_path, resolved_file, relation='imports')

                elif tag in ['class_name', 'interface_name', 'type_name', 'func_name']:
                    node_id = f"{rel_path}::{text}"
                    kind = tag.replace('_name', '')
                    # Extract snippet for UI tooltip
                    snippet = content[node.start_byte:min(node.end_byte, node.start_byte+300)]
                    
                    # Store symbol in graph
                    self.graph.add_node(node_id, type='entity', name=text, kind=kind, filePath=rel_path, snippet=snippet)
                    self.graph.add_edge(rel_path, node_id, relation='defines')

        except Exception as e:
            print(f"Error parsing {rel_path}: {e}")

    def get_context(self, module_type: str) -> str:
        context = ""

        # Helper: Recursive Dependency Injection
        def get_recursive_dependencies(start_files, depth=1):
            deps_content = ""
            visited = set(start_files)
            queue = list(start_files)
            
            current_depth = 0
            while queue and current_depth < depth:
                next_level = []
                for current_file in queue:
                    if current_file in self.graph:
                        # Find imports (graph successors)
                        for neighbor in self.graph.successors(current_file):
                            # Only process files, not internal symbols
                            if '::' not in neighbor and neighbor not in visited:
                                if neighbor in self.file_map:
                                    # Filter: Only include Types/Interfaces/Models/DTOs
                                    # This drastically reduces context noise while keeping essential data structures
                                    if any(x in neighbor.lower() for x in ['type', 'interface', 'dto', 'model', 'entity', 'enum', 'config']):
                                        deps_content += f"\n--- DEPENDENCY: {neighbor} ---\n{self.file_map[neighbor]}\n"
                                        visited.add(neighbor)
                                        next_level.append(neighbor)
                queue = next_level
                current_depth += 1
            return deps_content

        if module_type == 'api_ref':
            # 1. Find Services & Controllers
            primary_files = []
            for path, content in self.file_map.items():
                if path.endswith(('.ts', '.js')) and ('service' in path.lower() or 'api' in path.lower() or 'controller' in path.lower()):
                    primary_files.append(path)
                    context += f"\n--- Service/Controller: {path} ---\n{content}"
            
            # 2. Add Deep Dependencies (DTOs, Interfaces)
            context += get_recursive_dependencies(primary_files, depth=2)

        elif module_type == 'components':
            # 1. Find React Components
            primary_files = []
            for path, content in self.file_map.items():
                if path.endswith(('.tsx', '.jsx')) and not '.test.' in path:
                     if 'export' in content: 
                         primary_files.append(path)
                         context += f"\n--- Component: {path} ---\n{content}"
            
            # 2. Add Props & Types
            context += get_recursive_dependencies(primary_files, depth=1)

        elif module_type == 'erd':
            # Find entities via graph attributes
            entity_nodes = [n for n, attr in self.graph.nodes(data=True) if attr.get('type') == 'entity']
            files = set([n.split('::')[0] for n in entity_nodes])
            for f in files:
                if f in self.file_map: context += f"\n--- File: {f} ---\n{self.file_map[f]}"

        elif module_type == 'root':
            pkg = self.file_map.get('package.json') or self.file_map.get('requirements.txt', '')
            context = f"Project Structure:\n{self.tree_structure}\n\nDependencies:\n{pkg}"
            
        elif module_type == 'sequence':
             for path, content in self.file_map.items():
                if any(k in path.lower() for k in ['controller', 'service', 'use', 'api']):
                     context += f"\n--- File: {path} ---\n{content}"
                     
        elif module_type == 'arch':
             context = self.tree_structure + "\n"
             for conf in ['package.json', 'tsconfig.json', 'vite.config.ts', 'docker-compose.yml']:
                 if conf in self.file_map: context += f"\n--- {conf} ---\n{self.file_map[conf]}"

        return context[:50000] # Safe limit for context window

    def get_project_stats(self):
        stats = []
        lang_counts = {}
        total_lines = 0
        for path, content in self.file_map.items():
            ext = os.path.splitext(path)[1]
            total_lines += len(content.split('\n'))
            lang_counts[ext] = lang_counts.get(ext, 0) + 1
        
        stats.append({"label": "Files", "value": str(len(self.file_map))})
        stats.append({"label": "LoC", "value": f"{total_lines:,}"})
        if lang_counts:
            top_lang = max(lang_counts, key=lang_counts.get)
            stats.append({"label": "Main Lang", "value": top_lang})
        return stats

    def export_knowledge_graph(self):
        """
        Export graph in a format compatible with Frontend CodeSymbol interface.
        Crucial to avoid 'Cannot read properties of undefined' errors in LiveVisualization.
        """
        output = {}
        for node, attrs in self.graph.nodes(data=True):
            # Calculate relationships from edges
            calls = list(self.graph.successors(node))
            called_by = list(self.graph.predecessors(node))
            
            output[node] = {
                'id': node,
                'name': attrs.get('name', os.path.basename(node)),
                'kind': attrs.get('kind', 'file' if attrs.get('type') == 'file' else 'variable'),
                'filePath': attrs.get('filePath', node),
                'codeSnippet': attrs.get('snippet', ''),
                'relationships': {
                    'calledBy': called_by, 
                    'calls': calls
                },
                'complexityScore': 1
            }
        return output

    def search_context(self, query, limit=5):
        results = []
        q = query.lower()
        for path, content in self.file_map.items():
            score = content.lower().count(q)
            if q in path.lower(): score += 10
            if score > 0:
                results.append((score, path, content[:2000]))
        results.sort(key=lambda x: x[0], reverse=True)
        return results[:limit]
