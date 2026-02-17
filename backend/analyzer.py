import os
import networkx as nx
from tree_sitter import Parser
from tree_sitter_languages import get_language

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

# Queries to extract imports and class definitions for different languages
QUERIES = {
    'typescript': """
        (import_statement source: (string) @import_path)
        (class_declaration name: (type_identifier) @class_name)
        (interface_declaration name: (type_identifier) @interface_name)
        (function_declaration name: (identifier) @func_name)
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
        self.symbol_table = {} # Store symbol details for chat/graph

    def _get_parser_for_file(self, filename):
        ext = os.path.splitext(filename)[1]
        lang_name = LANGUAGE_MAP.get(ext)
        if not lang_name:
            return None, None
            
        if lang_name not in self.parsers:
            try:
                # Direct instantiation to bypass potential wrapper version mismatches
                parser = Parser()
                language = get_language(lang_name)
                parser.set_language(language)
                
                self.parsers[lang_name] = {
                    'parser': parser,
                    'language': language
                }
            except TypeError as te:
                 print(f"TypeError loading parser for {lang_name}: {te}")
                 return None, None
            except Exception as e:
                print(f"Could not load parser for {lang_name}: {e}")
                return None, None
                
        return self.parsers[lang_name]['parser'], self.parsers[lang_name]['language']

    def analyze(self):
        file_tree = []
        if not os.path.exists(self.repo_path):
             print(f"Path does not exist: {self.repo_path}")
             return

        for root, dirs, files in os.walk(self.repo_path):
            # Filter ignored directories
            dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', 'dist', 'build', '__pycache__', 'venv', '.next', '.idea', '.vscode']]
            
            for file in files:
                if file.endswith(tuple(LANGUAGE_MAP.keys())) or file.endswith(('.json', '.md', '.txt')):
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, self.repo_path)
                    
                    try:
                        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            self.file_map[rel_path] = content
                            
                        self.graph.add_node(rel_path, type='file', size=len(content))
                        file_tree.append(rel_path)

                        self._parse_dependencies(rel_path, content, file)
                            
                    except Exception as e:
                        print(f"Error reading {rel_path}: {e}")

        self.tree_structure = "\n".join(file_tree[:500])

    def _parse_dependencies(self, rel_path, content, filename):
        parser, language = self._get_parser_for_file(filename)
        if not parser or not language:
            return

        try:
            tree = parser.parse(bytes(content, "utf8"))
            ext = os.path.splitext(filename)[1]
            lang_name = LANGUAGE_MAP.get(ext)
            query_scm = QUERIES.get(lang_name)
            
            if not query_scm:
                return

            query = language.query(query_scm)
            captures = query.captures(tree.root_node)

            for node, tag in captures:
                text = content[node.start_byte:node.end_byte].strip('"\'')
                
                if tag == 'import_path':
                    self.graph.add_edge(rel_path, text, relation='imports')
                
                elif tag in ['class_name', 'interface_name', 'func_name']:
                    # Build rich symbol data for the graph/chat
                    node_id = f"{rel_path}::{text}"
                    kind = tag.replace('_name', '')
                    
                    # Extract snippet (limited lines)
                    start_line = node.start_point[0]
                    end_line = min(node.end_point[0], start_line + 20)
                    snippet = "\n".join(content.split('\n')[start_line:end_line+1])

                    symbol_data = {
                        "id": node_id,
                        "name": text,
                        "kind": kind,
                        "filePath": rel_path,
                        "line": start_line + 1,
                        "codeSnippet": snippet,
                        "relationships": {"calledBy": [], "calls": []} # Simplified for now
                    }
                    
                    self.symbol_table[node_id] = symbol_data
                    
                    self.graph.add_node(node_id, type='entity', **symbol_data)
                    self.graph.add_edge(rel_path, node_id, relation='defines')

        except Exception as e:
            pass

    def get_context(self, module_type: str) -> str:
        context = ""
        
        # --- Helper to append type definitions for better inference ---
        def append_type_definitions():
            type_ctx = "\n\n--- TYPE DEFINITIONS (Interfaces/DTOs) ---\n"
            found_types = False
            for path, content in self.file_map.items():
                # Heuristic: files named 'types', 'interfaces', 'dto', 'model', or ending in .d.ts
                lower_path = path.lower()
                if any(k in lower_path for k in ['type', 'interface', 'dto', 'model']) or path.endswith('.d.ts'):
                    type_ctx += f"\n--- File: {path} ---\n{content}\n"
                    found_types = True
            return type_ctx if found_types else ""

        if module_type == 'root':
            pkg = self.file_map.get('package.json') or self.file_map.get('requirements.txt', '')
            context = f"Project Structure:\n{self.tree_structure}\n\nDependencies:\n{pkg}"
            
        elif module_type == 'setup':
            context = "Project Structure:\n" + self.tree_structure + "\n"
            for f in ['package.json', 'requirements.txt', 'README.md', '.env.example', 'docker-compose.yml', 'Dockerfile']:
                if f in self.file_map:
                    context += f"\n--- {f} ---\n{self.file_map[f]}"

        elif module_type == 'erd':
            entity_nodes = [n for n, attr in self.graph.nodes(data=True) if attr.get('type') == 'entity']
            files = set()
            for entity in entity_nodes:
                files.update(list(self.graph.predecessors(entity)))
            for f in files:
                if f in self.file_map: context += f"\n--- File: {f} ---\n{self.file_map[f]}"
        
        elif module_type == 'sequence':
             # Focus on Logic, not just definitions
             for path, content in self.file_map.items():
                lower_path = path.lower()
                if any(k in lower_path for k in ['service', 'context', 'store', 'provider', 'usecase', 'logic']):
                     context += f"\n--- File: {path} ---\n{content}"
        
        elif module_type == 'api':
            for path, content in self.file_map.items():
                if any(k in path.lower() for k in ['controller', 'route', 'api', 'app.py', 'main.py']):
                    context += f"\n--- File: {path} ---\n{content}"

        elif module_type == 'components':
            for path, content in self.file_map.items():
                if path.endswith(('.tsx', '.jsx')) and not any(x in path.lower() for x in ['.test.', 'stories']):
                     if 'export' in content: context += f"\n--- Component: {path} ---\n{content}"
            # IMPORTANT: Append types so the LLM knows what 'Props' interface actually contains
            context += append_type_definitions()

        elif module_type == 'api_ref':
            for path, content in self.file_map.items():
                if path.endswith(('.ts', '.js', '.py')) and ('service' in path.lower() or 'api' in path.lower()):
                    context += f"\n--- Service: {path} ---\n{content}"
            # IMPORTANT: Append types so the LLM can expand DTOs/Interfaces
            context += append_type_definitions()

        elif module_type == 'arch':
             context = self.tree_structure + "\n"
             for conf in ['package.json', 'requirements.txt', 'go.mod', 'docker-compose.yml']:
                 if conf in self.file_map: context += f"\n--- {conf} ---\n{self.file_map[conf]}"
        
        return context[:40000] # Slightly increased limit for types

    def get_project_stats(self):
        """Calculates file counts, lines of code, and language breakdown."""
        stats = []
        lang_counts = {}
        total_lines = 0
        total_files = len(self.file_map)

        for path, content in self.file_map.items():
            ext = os.path.splitext(path)[1]
            lines = len(content.split('\n'))
            total_lines += lines
            lang_counts[ext] = lang_counts.get(ext, 0) + 1

        stats.append({"label": "Files", "value": str(total_files)})
        stats.append({"label": "LoC", "value": f"{total_lines:,}"})
        
        # Top language
        if lang_counts:
            top_lang = max(lang_counts, key=lang_counts.get)
            stats.append({"label": "Main Lang", "value": top_lang})
        
        return stats

    def export_knowledge_graph(self):
        return self.symbol_table

    def search_context(self, query: str, limit: int = 5):
        scores = []
        query_tokens = query.lower().split()

        for path, content in self.file_map.items():
            score = 0
            lower_content = content.lower()
            for token in query_tokens:
                if len(token) > 3 and token in lower_content:
                    score += 1
            for token in query_tokens:
                if len(token) > 3 and token in path.lower():
                    score += 3
            if score > 0:
                scores.append((score, path, content[:2000]))

        scores.sort(key=lambda x: x[0], reverse=True)
        return scores[:limit]
