import os
import json
import re
import networkx as nx

from services.db_service import VectorDBService

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
        self.db_service = VectorDBService()
        self.repo_id = self.db_service.build_repo_id(repo_path)

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
                    self.graph.add_node(node_id, type='entity', name=text, kind=kind, filePath=rel_path, snippet=snippet, line=node.start_point[0] + 1)
                    self.graph.add_edge(rel_path, node_id, relation='defines')

        except Exception as e:
            print(f"Error parsing {rel_path}: {e}")

    def _extract_types_only(self, content: str) -> str:
        lines = content.split('\n')
        filtered = []
        capture = False
        brace_depth = 0

        for line in lines:
            stripped = line.strip()
            if any(token in stripped for token in ['export interface', 'export type', 'export enum', 'declare interface', 'declare type', 'class ']):
                capture = True
                brace_depth = stripped.count('{') - stripped.count('}')
                filtered.append(line)
                continue

            if capture:
                filtered.append(line)
                brace_depth += stripped.count('{') - stripped.count('}')
                if brace_depth <= 0 and (stripped.endswith('}') or stripped.endswith('};') or stripped.endswith(';')):
                    capture = False

        return "\n".join(filtered) if filtered else content

    def calculate_complexity(self, content: str) -> int:
        score = 0
        for keyword in ['if', 'else', 'for', 'while', 'switch', 'catch', '&&', '||']:
            score += content.count(keyword + ' ') + content.count(keyword + '(')
        return score

    def get_code_health(self):
        hotspots = []
        for path, content in self.file_map.items():
            score = self.calculate_complexity(content)
            if score > 20:
                hotspots.append({'path': path, 'score': score})
        hotspots.sort(key=lambda x: x['score'], reverse=True)
        return hotspots[:20]

    def resolve_barrel_exports(self, file_path: str, content: str):
        """
        Follow barrel exports such as:
        export * from './request.model'
        export { A, B } from './dto'
        """
        resolved_files = []
        barrel_pattern = re.compile(r'export\s+(?:\*|\{[^}]+\})\s+from\s+[\"\']([^\"\']+)[\"\']')

        for import_path in barrel_pattern.findall(content):
            real_path = self._resolve_import_path(file_path, import_path)
            if real_path and real_path not in resolved_files:
                resolved_files.append(real_path)

        return resolved_files

    def get_context(self, module_type: str) -> str:
        MAX_CHARS = 35000
        context = ""

        def add_to_context(header, content):
            nonlocal context
            if len(context) >= MAX_CHARS:
                return False
            chunk = f"\n--- {header} ---\n{content}\n"
            if len(context) + len(chunk) > MAX_CHARS:
                context += "\n\n... [Context Truncated Limit Reached] ...\n"
                return False
            context += chunk
            return True

        def extract_referenced_types(content):
            candidates = set(re.findall(r'\bI[A-Z][A-Za-z0-9_]+\b', content))
            candidates.update(re.findall(r'\b[A-Z][A-Za-z0-9_]*(?:Request|Response|Dto|DTO|Model|Payload|Input|Output)\b', content))

            # Capture explicit generic response/input types used in HTTP calls:
            # http.get<T>(), http.post<T>(), ...
            generic_chunks = re.findall(r'http\.(?:get|post|put|patch|delete)\s*<([^>]+)>', content, re.IGNORECASE)
            for chunk in generic_chunks:
                candidates.update(re.findall(r'\b[A-Z][A-Za-z0-9_]+\b', chunk))

            # Capture common return wrappers where response types may be implicit in service bodies.
            wrapped_types = re.findall(r'\b(?:Promise|Observable)\s*<([^>]+)>', content)
            for chunk in wrapped_types:
                candidates.update(re.findall(r'\b[A-Z][A-Za-z0-9_]+\b', chunk))

            return {c for c in candidates if len(c) > 2}

        def generate_type_name_variants(type_name):
            variants = {type_name}
            if type_name.startswith('I') and len(type_name) > 1 and type_name[1].isupper():
                variants.add(type_name[1:])

            kebab = re.sub(r'(?<!^)(?=[A-Z])', '-', type_name).lower()
            variants.add(kebab)
            variants.add(type_name.lower())

            for suffix in ['request', 'response', 'dto', 'model', 'payload', 'input', 'output']:
                variants.add(type_name.lower().replace(suffix, '').strip('-_'))

            return {v for v in variants if v}

        def find_type_definition_files(type_name, included_files):
            hits = []
            variants = generate_type_name_variants(type_name)
            declaration_pattern = re.compile(rf"\b(?:export\s+)?(?:interface|type|enum|class)\s+{re.escape(type_name)}\b")

            for path, content in self.file_map.items():
                if path in included_files:
                    continue
                if not path.endswith(('.ts', '.tsx', '.d.ts', '.js')):
                    continue

                path_lower = path.lower()
                declaration_hit = declaration_pattern.search(content) is not None
                filename_hint_hit = any(v and v in path_lower for v in variants)
                mention_hit = any(v and re.search(rf"\b{re.escape(v)}\b", content.lower()) for v in variants if len(v) > 2)

                if declaration_hit or (filename_hint_hit and mention_hit):
                    score = (3 if declaration_hit else 0) + (2 if filename_hint_hit else 0) + (1 if mention_hit else 0)
                    hits.append((score, path))

            hits.sort(key=lambda x: x[0], reverse=True)
            ordered = []
            seen = set()
            for _, path in hits:
                if path not in seen:
                    ordered.append(path)
                    seen.add(path)
            return ordered

        def find_type_via_barrel_chain(type_name, included_files, max_hops=4):
            """
            Fallback for hidden DTOs/interfaces behind nested index.ts barrel chains.
            """
            declaration_pattern = re.compile(rf"\b(?:export\s+)?(?:interface|type|enum|class)\s+{re.escape(type_name)}\b")
            barrel_files = [p for p in self.file_map.keys() if p.endswith(('index.ts', 'index.tsx', 'index.js')) and p not in included_files]
            visited = set()
            queue = [(b, 0) for b in barrel_files]
            matches = []

            while queue:
                current, hop = queue.pop(0)
                if current in visited or hop > max_hops:
                    continue
                visited.add(current)

                content = self.file_map.get(current, '')
                targets = self.resolve_barrel_exports(current, content)
                for target in targets:
                    if target in visited or target not in self.file_map:
                        continue

                    target_content = self.file_map[target]
                    if declaration_pattern.search(target_content):
                        matches.append(target)
                        continue

                    if target.endswith(('index.ts', 'index.tsx', 'index.js')):
                        queue.append((target, hop + 1))

            # keep order deterministic and deduplicated
            ordered = []
            seen = set()
            for m in matches:
                if m not in seen and m not in included_files:
                    ordered.append(m)
                    seen.add(m)
            return ordered

        def get_deep_dependencies(start_files, max_depth=3):
            collected = []
            visited = set(start_files)
            queue = [(f, 0) for f in start_files]

            while queue:
                current_file, depth = queue.pop(0)
                if depth >= max_depth or current_file not in self.graph:
                    continue

                for neighbor in self.graph.successors(current_file):
                    neighbor_path = neighbor.split('::')[0]
                    if neighbor_path in visited or neighbor_path not in self.file_map:
                        continue

                    dep_content = self.file_map[neighbor_path]
                    lower = neighbor_path.lower()
                    looks_like_type_file = any(x in lower for x in ['dto', 'model', 'interface', 'type', 'entity', 'request', 'response'])
                    barrel_targets = self.resolve_barrel_exports(neighbor_path, dep_content)
                    is_barrel_file = neighbor_path.endswith(('index.ts', 'index.tsx', 'index.js')) or len(barrel_targets) > 0

                    # Keep traversing barrel files even if they don't contain direct definitions.
                    if not looks_like_type_file and not is_barrel_file:
                        continue

                    visited.add(neighbor_path)
                    queue.append((neighbor_path, depth + 1))

                    # Only include content-heavy chunks when likely useful as type containers.
                    if looks_like_type_file or neighbor_path.endswith(('.d.ts', 'types.ts')):
                        collected.append((neighbor_path, depth + 1, self._extract_types_only(dep_content)))

                    # Expand barrel re-exports to reach hidden DTO/interface files.
                    for barrel_target in barrel_targets:
                        if barrel_target in visited or barrel_target not in self.file_map:
                            continue
                        visited.add(barrel_target)
                        queue.append((barrel_target, depth + 1))
                        collected.append((barrel_target, depth + 1, self._extract_types_only(self.file_map[barrel_target])))

            return collected, visited

        if module_type == 'api_ref':
            # API reference needs richer context for DTO/interface expansion.
            MAX_CHARS = 100000
            primary_files = []
            included_files = set()
            referenced_types = set()

            for path, content in self.file_map.items():
                if path.endswith(('.ts', '.js')) and any(k in path.lower() for k in ['service', 'api', 'controller']) and '.spec.' not in path:
                    primary_files.append(path)
                    referenced_types.update(extract_referenced_types(content))

            # Priority 1: add model/type definitions first so they are never dropped
            # by long service/controller files filling the context budget.
            for type_name in sorted(referenced_types):
                if len(context) >= MAX_CHARS:
                    break

                if type_name in {'Promise', 'Observable', 'string', 'number', 'boolean', 'void', 'any', 'unknown'}:
                    continue

                primary_hits = find_type_definition_files(type_name, included_files)
                barrel_hits = find_type_via_barrel_chain(type_name, included_files)

                for path in primary_hits + [b for b in barrel_hits if b not in primary_hits]:
                    if add_to_context(f"Dependency Model ({type_name}): {path}", self._extract_types_only(self.file_map[path])):
                        included_files.add(path)
                    else:
                        break

            # Priority 2: then add graph-resolved dependencies (types only).
            deep_deps, _ = get_deep_dependencies(primary_files, max_depth=3)
            for dep_path, dep_depth, dep_content in deep_deps:
                if len(context) >= MAX_CHARS:
                    break
                if dep_path in included_files:
                    continue
                if add_to_context(f"Dependency (D{dep_depth}): {dep_path}", dep_content):
                    included_files.add(dep_path)
                else:
                    break

            # Priority 3: add entry service/controller code for endpoint semantics.
            for path in primary_files:
                if len(context) >= MAX_CHARS:
                    break
                if add_to_context(f"Entry: {path}", self.file_map[path]):
                    included_files.add(path)
                else:
                    break

            # Final pass: include any newly referenced types discovered after deps.
            referenced_after_deps = set(referenced_types)
            for path in included_files:
                referenced_after_deps.update(extract_referenced_types(self.file_map.get(path, '')))

            for type_name in sorted(referenced_after_deps):
                if len(context) >= MAX_CHARS:
                    break

                primary_hits = find_type_definition_files(type_name, included_files)
                barrel_hits = find_type_via_barrel_chain(type_name, included_files)

                for path in primary_hits + [b for b in barrel_hits if b not in primary_hits]:
                    if add_to_context(f"Found via Search ({type_name}): {path}", self._extract_types_only(self.file_map[path])):
                        included_files.add(path)
                    else:
                        break

        elif module_type == 'components':
            for path, content in self.file_map.items():
                if len(context) >= MAX_CHARS:
                    break
                if path.endswith('.tsx') and '.test.' not in path:
                    component_name = path.split('/')[-1].replace('.tsx', '')
                    if 'export default function' in content or f'const {component_name}' in content:
                        if not add_to_context(f"Component: {path}", content):
                            break

        elif module_type == 'erd':
            entity_nodes = [n for n, attr in self.graph.nodes(data=True) if attr.get('type') == 'entity']
            files = sorted(list(set([n.split('::')[0] for n in entity_nodes])), key=lambda f: len(self.file_map.get(f, '')))
            for entity_file in files:
                if entity_file in self.file_map and not add_to_context(f"Entity File: {entity_file}", self.file_map[entity_file]):
                    break

        elif module_type == 'root':
            add_to_context("package.json", self.file_map.get('package.json', ''))
            add_to_context("Project Structure", self.tree_structure)

        elif module_type == 'setup':
            setup_files = [
                'README.md',
                'package.json',
                'requirements.txt',
                'pyproject.toml',
                'Pipfile',
                'docker-compose.yml',
                'Dockerfile',
                '.env.example',
                '.env.sample',
                'tsconfig.json',
                'vite.config.ts'
            ]
            for file_name in setup_files:
                if file_name in self.file_map:
                    if not add_to_context(file_name, self.file_map[file_name]):
                        break

            # Include environment/config scripts if present.
            for path, content in self.file_map.items():
                lower = path.lower()
                if any(k in lower for k in ['env', 'config', 'setup', 'install']) and path.endswith(('.md', '.txt', '.json', '.ts', '.js', '.yml', '.yaml')):
                    if not add_to_context(f"Setup Related: {path}", content):
                        break

        elif module_type == 'sequence':
            for path, content in self.file_map.items():
                if any(k in path.lower() for k in ['controller', 'service', 'usecase', 'page.tsx']):
                    if not add_to_context(f"Entry Point: {path}", content):
                        break

        elif module_type == 'arch':
            context = self.tree_structure + "\n"
            for conf in ['package.json', 'tsconfig.json', 'vite.config.ts', 'docker-compose.yml', 'Dockerfile']:
                if conf in self.file_map and not add_to_context(conf, self.file_map[conf]):
                    break

        return context

    def _build_ingestion_chunks(self):
        chunks = []

        for path, content in self.file_map.items():
            chunks.append({
                "text": content,
                "file_path": path,
                "start_line": 1,
                "end_line": len(content.splitlines()) or 1,
                "type": "file_full",
                "name": path,
            })

        for node_id, attrs in self.graph.nodes(data=True):
            if attrs.get("type") != "entity":
                continue

            file_path = attrs.get("filePath")
            name = attrs.get("name") or node_id
            line = int(attrs.get("line", 1))
            snippet = attrs.get("snippet", "")
            kind = attrs.get("kind", "entity")

            if not file_path or not snippet:
                continue

            chunks.append({
                "text": snippet,
                "file_path": file_path,
                "start_line": line,
                "end_line": line + max(1, snippet.count("\n")),
                "type": kind,
                "name": name,
            })

        return chunks

    def analyze_and_ingest(self, replace_existing: bool = True):
        self.analyze()
        if replace_existing:
            self.db_service.clear_repo(self.repo_id)

        chunks = self._build_ingestion_chunks()
        self.db_service.ingest_code_chunks(chunks, repo_id=self.repo_id)
        return {
            "repo_id": self.repo_id,
            "chunks_ingested": len(chunks),
        }

    def get_project_stats(self):
        stats = []
        lang_counts = {}
        total_lines = 0
        total_complexity = 0

        for path, content in self.file_map.items():
            ext = os.path.splitext(path)[1]
            total_lines += len(content.split('\n'))
            total_complexity += self.calculate_complexity(content)
            lang_counts[ext] = lang_counts.get(ext, 0) + 1

        stats.append({"label": "Files", "value": str(len(self.file_map))})
        stats.append({"label": "LoC", "value": f"{total_lines:,}"})
        stats.append({"label": "Complexity", "value": str(total_complexity)})
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
                'line': attrs.get('line', 1),
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
