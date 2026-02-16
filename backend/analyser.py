import os
import networkx as nx
from tree_sitter_languages import get_language, get_parser
import json


class RepoAnalyzer:
    def __init__(self, repo_path: str):
        self.repo_path = repo_path
        self.graph = nx.DiGraph()
        self.file_map = {}  # {rel_path: content}
        self.tree_structure = ""

        # تنظیمات Tree-sitter
        try:
            self.parser = get_parser('typescript')
            self.language = get_language('typescript')
        except Exception as e:
            print(f"Warning: Tree-sitter initialization failed: {e}")
            self.parser = None
            self.language = None

    def analyze(self):
        """اسکن کامل پروژه و ساخت گراف دانش"""
        file_tree = []

        if not os.path.exists(self.repo_path):
            raise ValueError(f"Repository path does not exist: {self.repo_path}")

        for root, dirs, files in os.walk(self.repo_path):
            # فیلتر کردن پوشه‌های مزاحم
            dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', 'dist', 'build', '__pycache__', 'venv', '.next']]

            for file in files:
                if file.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.py')):
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, self.repo_path)

                    # 1. ذخیره محتوا
                    try:
                        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            self.file_map[rel_path] = content

                        # 2. افزودن به گراف
                        self.graph.add_node(rel_path, type='file', size=len(content))
                        file_tree.append(rel_path)

                        # 3. تحلیل AST (فقط برای فایل‌های کد و اگر پارسر لود شده باشد)
                        if self.parser and file.endswith(('.ts', '.tsx', '.js')):
                            self._parse_dependencies(rel_path, content)

                    except Exception as e:
                        print(f"Error reading {rel_path}: {e}")

        self.tree_structure = "\n".join(file_tree[:500])  # محدود کردن برای پرامپت

    def _parse_dependencies(self, rel_path, content):
        """استخراج کلاس‌ها و ایمپورت‌ها با Tree-sitter"""
        try:
            tree = self.parser.parse(bytes(content, "utf8"))
            
            # کوئری برای پیدا کردن Importها و Classها
            query_scm = """
            (import_statement source: (string) @import_path)
            (class_declaration name: (type_identifier) @class_name)
            (interface_declaration name: (type_identifier) @interface_name)
            """
            query = self.language.query(query_scm)
            captures = query.captures(tree.root_node)

            for node, tag in captures:
                text = content[node.start_byte:node.end_byte].strip('"\'')
                
                if tag == 'import_path':
                    # سعی در نرمال‌سازی مسیر ایمپورت
                    # (اینجا منطق ساده است، برای Aliasها نیاز به map دارید)
                    target = text
                    if text.startswith('.'):
                        # تبدیل مسیر نسبی به مسیر فایل (ساده‌سازی شده)
                        self.graph.add_edge(rel_path, target, relation='imports')
                
                elif tag in ['class_name', 'interface_name']:
                    # ثبت موجودیت‌ها برای ERD و Class Diagram
                    node_id = f"{rel_path}::{text}"
                    self.graph.add_node(node_id, type='entity', name=text)
                    self.graph.add_edge(rel_path, node_id, relation='defines')
        except Exception as e:
            print(f"Error parsing dependencies for {rel_path}: {e}")

    def get_context(self, module_type: str) -> str:
        """تولید کانتکست هوشمند بر اساس نوع ماژول درخواستی"""

        context = ""

        if module_type == 'root':
            # برای README: ساختار فایل + package.json
            pkg = self.file_map.get('package.json', '{}')
            context = f"Project Structure:\n{self.tree_structure}\n\nPackage.json:\n{pkg}"

        elif module_type == 'erd':
            # فقط فایل‌هایی که Entity/Model/Interface دارند
            relevant_nodes = [n for n, attr in self.graph.nodes(data=True) if attr.get('type') == 'entity']
            # پیدا کردن فایل‌های مادر این نودها
            files_to_read = set()
            for node in relevant_nodes:
                predecessors = list(self.graph.predecessors(node))
                files_to_read.update(predecessors)

            for f in files_to_read:
                if f in self.file_map:
                    context += f"\n--- File: {f} ---\n{self.file_map[f]}"

        elif module_type == 'sequence':
            # فایل‌های کنترلر، سرویس و هوک
            for path, content in self.file_map.items():
                if any(k in path.lower() for k in ['controller', 'service', 'use', 'api']):
                    context += f"\n--- File: {path} ---\n{content}"

        elif module_type == 'api':
            # پیدا کردن روت‌ها و کنترلرها
            for path, content in self.file_map.items():
                if 'route' in path.lower() or 'controller' in path.lower() or 'api' in path.lower():
                    context += f"\n--- File: {path} ---\n{content}"

        elif module_type == 'arch':
             # فایل‌های مهم برای معماری
             context = self.tree_structure + "\n"
             # اضافه کردن package.json یا requirements.txt
             for conf in ['package.json', 'requirements.txt', 'go.mod', 'Cargo.toml']:
                 if conf in self.file_map:
                     context += f"\n--- {conf} ---\n{self.file_map[conf]}"

        else:
            # حالت پیش‌فرض: خلاصه فایل‌های مهم
            context = self.tree_structure

        # محدود کردن سایز کانتکست (Token Limit)
        return context[:30000]  # حدوداً 8k توکن
