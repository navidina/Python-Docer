
export const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.vscode', '.idea', 'dist', 'build', 'coverage', 'tmp', 'temp', '.next', 'public',
  'icon', 'icons', 'images', 'img', 'assets',
  'venv', '.venv', 'env', '.env', 'virtualenv', 'envs',
  '__pycache__', 'Lib', 'lib', 'Scripts', 'bin', 'site-packages', 'Include', 'share', 'etc', 'man',
  'models', 'weights', 'downloads', 'fonts', 'video', 'audios'
]);

// New: Explicit Blacklist for Noisy Files
export const IGNORED_FILENAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'composer.lock', 'Gemfile.lock',
  '.gitignore', '.gitattributes', '.prettierrc', 
  '.eslintrc', '.eslintrc.js', '.eslintrc.json', 'eslintrc.json',
  '.stylelintrc', '.stylelintrc.json', '.stylelintrc.js', 'stylelintrc.json',
  '.editorconfig', 'LICENSE', 'LICENSE.txt', 'CHANGELOG.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md',
  'tsconfig.tsbuildinfo', '.DS_Store', 'thumbs.db'
]);

export const ALLOWED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.json', '.md', '.yml', '.yaml', 
  '.txt', '.dockerfile', '.sh', '.bat', '.java', '.c', '.cpp', '.go', '.rs', 
  '.sql', '.prisma', '.tf', '.tfvars', '.conf', '.php', '.rb', '.cs'
]);

export const LANGUAGE_MAP: Record<string, string> = {
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.py': 'Python',
  '.html': 'HTML',
  '.css': 'CSS',
  '.json': 'JSON',
  '.md': 'Markdown',
  '.yml': 'YAML',
  '.yaml': 'YAML',
  '.dockerfile': 'Docker',
  '.sh': 'Shell',
  '.bat': 'Batch',
  '.java': 'Java',
  '.c': 'C',
  '.cpp': 'C++',
  '.go': 'Go',
  '.rs': 'Rust',
  '.sql': 'SQL',
  '.prisma': 'Prisma DB',
  '.tf': 'Terraform',
  '.tfvars': 'Terraform',
  '.php': 'PHP',
  '.rb': 'Ruby',
  '.cs': 'C#'
};

export const CONFIG_FILES = new Set([
  'package.json', 'tsconfig.json', 'Dockerfile', 'docker-compose.yml',
  'requirements.txt', 'Cargo.toml', 'go.mod', 'pom.xml', 'Gemfile',
  'Makefile', 'README.md', 'vite.config.ts', 'vite.config.js', 'webpack.config.js',
  'schema.prisma', 'main.tf', '.env.example', 'tailwind.config.js', 'next.config.js'
]);

// Updated for LM Studio on specific IP
export const DEFAULT_MODEL = 'qwen2.5-coder-32b-instruct'; // Or "local-model" if generic
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-nomic-embed-text-v1.5';
export const OLLAMA_DEFAULT_URL = 'http://192.168.167.18:1234';

export const ARCH_RULES = [
  {
    name: "Separation of Concerns: UI -> DB",
    pattern: { source: /(components|pages|views|ui)/, target: /(database|prisma|mongoose|sql|db)/ },
    message: "لایه رابط کاربری (UI) نباید مستقیماً با دیتابیس صحبت کند. از لایه API/Service استفاده کنید.",
    severity: 'critical'
  },
  {
    name: "Layering: Utils -> Components",
    pattern: { source: /(utils|helpers|lib)/, target: /(components|pages)/ },
    message: "توابع کمکی (Utils) نباید به کامپوننت‌های UI وابسته باشند. این باعث وابستگی دوری می‌شود.",
    severity: 'warning'
  }
];

export const PERSONA_BLOCKCHAIN_ARCHITECT = `به عنوان یک معمار ارشد سیستم‌های بلاکچین (Lead Blockchain Architect) و تحلیلگر سیستم‌های مالی با تخصص در بازارهای بورس و زیرساخت‌های غیرمتمرکز عمل کن.`;

export const PROMPT_LEVEL_1_ROOT = `You are a Senior Technical Writer and Software Architect.
TASK: Write a comprehensive, professional README.md for this project in Persian (Farsi).

CRITICAL INSTRUCTION - EXECUTIVE SUMMARY:
1. Analyze the 'package.json' (dependencies, name), 'Main Entry File Snippets', and the directory structure deeply.
2. Deduce the EXACT nature of the project (e.g., "A modern React Admin Dashboard using Vite and Material UI", "A Python Django REST API for E-commerce").
3. **Start the README with a high-quality 1-2 paragraph Executive Summary** describing the project's purpose, tech stack, and value proposition.
4. DO NOT write generic phrases like "This is a project structure". Be specific.

STRUCTURE:
# [Project Name]
> [Your Smart Executive Summary Here]

## 🚀 Features
- Bullet points of specific features inferred from code (e.g., "Auth with JWT", "Data Visualization with Recharts").

## 📂 Project Structure
1. Generate a **Directory Map** only. 
2. **DO NOT list individual files** inside subdirectories.
3. For EACH directory, write a **short 1-sentence Persian description** explaining what it contains.
4. Format as a clean tree.

## 🛠 Tech Stack
- List main technologies found in package.json/imports.

## 🏗 Architecture
Briefly explain how the system works based on the provided code context.

RULES:
1. Output strictly in Markdown.
2. The Introduction MUST show you understood the code.`;

export const PROMPT_LEVEL_2_CODE = `ROLE: Senior Lead Developer. Analyze this file deeply in Persian.
STRICT LANGUAGE RULES:
1. Write explanations in Persian, BUT...
2. **KEEP ALL TECHNICAL TERMS IN ENGLISH** (e.g., Boolean, String, Integer, Float, true, false, null, undefined, React, Component, bracketSameLine, singleQuote).
3. **DO NOT TRANSLATE SYNTAX**: Never say "چهار نقطه‌گیر" for "Brackets" or "علامت کوتاه" for "Quotes". Keep them as {}, [], '', "".
4. Explain WHY the code is written this way and HOW it works.`;

export const PROMPT_LEVEL_BUSINESS = `ROLE: Business Analyst. Extract ONLY business logic in JSON format.`;

export const PROMPT_LEVEL_3_ARCH = `تحلیل معماری سیستم به زبان فارسی سلیس. روی الگوهای طراحی (MVC, Microservices, etc) و جریان داده تمرکز کن. اگر معماری چند لایه است، یک نمودار معماری کلی با Mermaid رسم کن.
نکته: اصطلاحات فنی (Microservice, Controller, Widget, State) را به انگلیسی بنویس.`;

// --- DEEP DIAGRAM PROMPTS (OPTIMIZED FOR VALIDITY) ---

export const PROMPT_LEVEL_7_ERD = `ROLE: Database Architect & Data Modeler.
TASK: Analyze the provided Typescript Interfaces, Classes, or DTOs to construct a precise Entity Relationship Diagram (ERD).

STRICT INSTRUCTIONS:
1. **Inference:** Extract entities based on interface/class definitions. Treat fields like 'id', '_id', 'userId', 'orderId' as Primary or Foreign keys.
2. **Relationships:** If a User has 'posts: Post[]', create a 'User ||--o{ Post' relationship.
3. **Syntax:** Use 'erDiagram' syntax.
4. **NO HALLUCINATIONS:** Only use fields explicitly present in the provided code snippets.

Output ONLY the mermaid code block.`;

export const PROMPT_LEVEL_8_CLASS = `ROLE: Software Architect.
TASK: Create a high-level 'classDiagram' based on the provided class/interface signatures.

STRICT INSTRUCTIONS:
1. **Focus:** Only include core domain models, services, and controllers. IGNORE utility classes, UI components (React), and config files.
2. **Relationships:** Show inheritance (<|--) and composition (*--) where visible.
3. **Syntax:** Use 'classDiagram'. Use tilde (~) for generics.
4. **Cleanliness:** Do not include methods if there are too many. Focus on properties and key public methods.

Output ONLY the mermaid code block.`;

export const PROMPT_LEVEL_5_SEQUENCE = `ROLE: System Architect.
TASK: Generate a 'sequenceDiagram' representing the core business flow found in the provided "Call Graph" and "Code Signatures".

STRICT INSTRUCTIONS:
1. **Real Names:** Do NOT use generic names like "Controller" or "Service". You MUST use the EXACT class/file names provided in the context (e.g., 'AuthService', 'UserController').
2. **Real Methods:** Label the arrows with the EXACT method names found in the code (e.g., 'login()', 'validateUser()').
3. **Flow:** Model the flow from Entry Point (e.g., API Route) -> Logic Layer -> Data Layer.
4. **Syntax:** Use 'sequenceDiagram' and 'autonumber'.

Output ONLY the mermaid code block.`;

export const PROMPT_DETAILED_SEQUENCE = `ROLE: System Architect.
TASK: Analyze the provided file and generate Mermaid 'sequenceDiagram' blocks for significant endpoints.
STRICT SYNTAX RULES:
1. Use 'sequenceDiagram' and 'autonumber'.
2. ALL Message labels MUST be quoted. 
   - Correct: User->>API: "POST /login"
3. Avoid using "note" if it contains complex text.
4. Output ONLY the mermaid code blocks.`;

export const PROMPT_LEVEL_9_INFRA = `ROLE: DevOps Engineer.
TASK: Create a 'flowchart TB' illustrating the infrastructure.
STRICT SYNTAX RULES:
1. Use 'flowchart TB'.
2. Node IDs must be alphanumeric (e.g., Docker, DB).
3. Labels MUST be quoted: Docker["Docker Container"]
   - INCORRECT: Docker[Docker Container]
4. Do NOT hallucinate cloud providers if not in code.
5. Output ONLY the mermaid code block.`;

export const PROMPT_LEVEL_API = `ROLE: Backend Architect.
TASK: Create a 'flowchart LR' visualizing API Endpoints.
STRICT SYNTAX RULES:
1. Use 'flowchart LR'.
2. Edge labels MUST be quoted: Client -->|"/api/users"| Controller
3. Node labels MUST be quoted: Controller["UserController"]
4. Output ONLY the mermaid code block.`;

export const PROMPT_DATA_FLOW = `ROLE: System Architect. 
TASK: Create a 'flowchart LR' showing data movement between components based on the provided Import/Dependency Graph.
STRICT INSTRUCTIONS:
1. **Graph Based:** Use the provided "Dependency Graph" to draw arrows between modules.
2. **Logic Only:** Focus on Controllers, Services, and Stores. Ignore UI components and Utils.
3. **Syntax:** Use 'flowchart LR'. Labels MUST be quoted.
4. Do NOT use 'classDef', ':::', or styling.
5. Output ONLY the mermaid code block.`;

export const PROMPT_USE_CASE = `ROLE: Product Manager.
TASK: Create a 'flowchart LR' representing Use Cases.
STRICT SYNTAX RULES:
1. Use Actor style: User(("User"))
2. Use Case style: Login(["Login Action"])
3. Labels MUST be quoted.
4. Output ONLY the mermaid code block.`;

export const PROMPT_SMART_AUDIT = `
ROLE: Senior Code Auditor & Security Expert.
TASK: Analyze the provided code for Security Vulnerabilities, Performance Bottlenecks, Logic Bugs, and Bad Practices.

INSTRUCTIONS:
1. Be extremely critical. Look for:
   - Security: SQL Injection, XSS, Hardcoded Secrets, Unsafe Regex.
   - Performance: Unnecessary re-renders, N+1 queries, Memory leaks, Heavy computations in render.
   - Bugs: Race conditions, Unhandled errors, Null pointer risks.
2. Return the result strictly as a JSON Array.
3. DO NOT write any conversational text. ONLY JSON.

JSON FORMAT:
[
  {
    "line": 10,
    "category": "security",
    "severity": "critical",
    "title": "Hardcoded Secret",
    "description": "API Key is hardcoded in the source.",
    "suggestion": "Move to .env file."
  }
]
`;
