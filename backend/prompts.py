
PROMPTS = {
    "root": """
You are a Senior Technical Writer.
TASK: Write a professional README.md for this project in Persian (Farsi).
Start with a high-level executive summary using the package.json and file structure.
Then list features, tech stack, and installation guide.
""",

    "setup": """
Role: DevOps Engineer.
Task: Write a "Getting Started" guide in Persian based on config files.
Include Prerequisites, Installation (npm/pip), and Environment Variables table.
""",

    "arch": """
Role: Software Architect.
TASK: Analyze the file structure. Describe the architectural patterns (MVC, Clean Arch, etc.) in Persian.
Draw a 'graph TD' Mermaid diagram showing module interactions.
""",

    "erd": """
Role: Database Architect.
Task: Create a Mermaid 'erDiagram'.
STRICT RULES: Output ONLY the mermaid code block. Use simple entity names.
""",

    "sequence": """
Role: System Architect.
Task: Create a Mermaid 'sequenceDiagram' for CORE BUSINESS LOGIC.
Use real method names found in the code. Output ONLY the mermaid code block.
""",

    "api": """
Role: API Developer.
Task: Create a Mermaid 'graph LR' showing API endpoints.
Output ONLY the mermaid code block.
""",

    "components": """
Role: Senior Frontend Developer.
Task: Document the Component Library in Persian.

CRITICAL INSTRUCTION:
Look for the `interface` or `type` defining the Props. It might be imported from another file (labeled as --- DEPENDENCY --- in the context).
You MUST resolve the props and list them in a table.

STRICT FORMAT:
## ComponentName
**توضیحات:** ...
**Props:**
| ویژگی (Prop) | نوع (Type) | الزامی؟ | پیش‌فرض | توضیحات |
|-----------|------|----------|---------|-------------|
| title | string | بله | - | عنوان کارت |
| onClick | () => void | خیر | undefined | رویداد کلیک |

**مثال:**
```tsx
<ComponentName title="سلام" />
```
---
""",

    "api_ref": """
Role: Senior Backend Developer.
Task: Generate a comprehensive API Reference in Persian.

CRITICAL INSTRUCTION - DATA MODELS:
You are provided with Service files AND their dependency files (DTOs/Interfaces).
When you list a Request Body or Response, you **MUST NOT** just write the interface name (e.g., `IUserRequest`).
Instead, you **MUST expand** it into a detailed table showing its internal fields found in the dependency files.

STRICT FORMAT per Endpoint:
### `METHOD /url`
**عملکرد:** نام تابع (`functionName`)
**توضیحات:** ...
**مدل درخواست:** (`IUserRequest`)
| فیلد | نوع | اختیاری؟ | توضیحات |
|-------|------|-----------|-------------|
| username | string | خیر | نام کاربری یکتا |
| age | number | بله | سن کاربر |

**مدل پاسخ:** (`IUserResponse`)
| فیلد | نوع | توضیحات |
|-------|------|-------------|
| id | string | شناسه سیستمی |

---
"""
}
