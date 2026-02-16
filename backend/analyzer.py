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
    """,
    'javascript': """
        (import_statement source: (string) @import_path)
        (class_declaration name: (identifier) @class_name)
    """,
    'python': """
        (import_from_statement module_name: (dotted_name) @import_path)
        (import_statement name: (dotted_name) @import_path)
        (class_definition name: (identifier) @class_name)
    """,
}

class RepoAnalyzer:
    def __init__(self, repo_path: str):
        self.repo_path = repo_path
        self.graph = nx.DiGraph()
        self.file_map = {}
        self.tree_structure = ""
        self.parsers = {} 

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
                 if "takes exactly 1 argument (2 given)" in str(te):
                     print(f"CRITICAL ERROR: tree-sitter version mismatch. Please run: pip install tree-sitter==0.20.4")
                 print(f"TypeError loading parser for {lang_name}: {te}")
                 return None, None
            except Exception as e:
                # Fallback or detailed logging
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
                
                elif tag in ['class_name', 'interface_name']:
                    node_id = f"{rel_path}::{text}"
                    self.graph.add_node(node_id, type='entity', name=text)
                    self.graph.add_edge(rel_path, node_id, relation='defines')
        except Exception as e:
            pass

    def get_context(self, module_type: str) -> str:
        context = ""
        
        if module_type == 'root':
            pkg = self.file_map.get('package.json') or self.file_map.get('requirements.txt', '')
            context = f"Project Structure:\n{self.tree_structure}\n\nDependencies:\n{pkg}"
            
        elif module_type == 'erd':
            # Get only files related to entities
            entity_nodes = [n for n, attr in self.graph.nodes(data=True) if attr.get('type') == 'entity']
            files_containing_entities = set()
            for entity in entity_nodes:
                predecessors = list(self.graph.predecessors(entity))
                files_containing_entities.update(predecessors)
            
            for f in files_containing_entities:
                if f in self.file_map:
                    context += f"\n--- File: {f} ---\n{self.file_map[f]}"

        elif module_type == 'sequence':
             for path, content in self.file_map.items():
                lower_path = path.lower()
                if any(k in lower_path for k in ['controller', 'service', 'handler', 'views', 'api', 'route']):
                     context += f"\n--- File: {path} ---\n{content}"
        
        elif module_type == 'api':
            for path, content in self.file_map.items():
                if 'route' in path.lower() or 'controller' in path.lower() or 'api' in path.lower():
                    context += f"\n--- File: {path} ---\n{content}"

        elif module_type == 'components':
            # BROADER DETECTION: Look for .tsx/.jsx files in various common UI folders
            # Also accept files starting with Capital letters (React convention)
            for path, content in self.file_map.items():
                if path.endswith(('.tsx', '.jsx')):
                    # Exclude tests and configs
                    if any(x in path.lower() for x in ['.test.', '.spec.', 'setup', 'config', 'stories']):
                        continue
                        
                    filename = os.path.basename(path)
                    lower_path = path.lower()
                    
                    # Criteria 1: In a UI-related folder
                    in_ui_folder = any(folder in lower_path for folder in ['components', 'views', 'pages', 'layouts', 'containers', 'ui', 'app'])
                    
                    # Criteria 2: PascalCase filename (e.g. UserCard.tsx)
                    is_pascal_case = filename[0].isupper() and 'index' not in filename.lower()
                    
                    if in_ui_folder or is_pascal_case:
                        # Optimization: Only include if it defines an interface/type (likely props) or exports a function
                        if 'export' in content:
                            context += f"\n--- Component: {path} ---\n{content}"

        elif module_type == 'api_ref':
            # BROADER DETECTION: Look for services, clients, repositories, or direct HTTP calls
            for path, content in self.file_map.items():
                # Allow .ts, .js, .py, .go, .java
                if path.endswith(('.ts', '.js', '.py', '.go', '.java')):
                    lower_path = path.lower()
                    # Criteria 1: File name hints at data fetching
                    is_data_layer = any(k in lower_path for k in ['service', 'api', 'controller', 'route', 'handler', 'client', 'repository', 'mutation', 'query', 'fetcher'])
                    
                    # Criteria 2: Content contains HTTP keywords
                    has_http_keywords = any(x in content for x in ['http', 'fetch', 'axios', 'request', '.get(', '.post(', '.put(', '.delete(', 'graphql', 'query', 'mutation'])
                    
                    if is_data_layer and has_http_keywords:
                        context += f"\n--- Service/API: {path} ---\n{content}"

        elif module_type == 'arch':
             context = self.tree_structure + "\n"
             for conf in ['package.json', 'requirements.txt', 'go.mod', 'Cargo.toml', 'docker-compose.yml', 'vite.config.ts', 'tsconfig.json']:
                 if conf in self.file_map:
                     context += f"\n--- {conf} ---\n{self.file_map[conf]}"
        
        return context[:35000]
