
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
Task: Generate a comprehensive API Reference.

INSTRUCTIONS:
1.  **Analyze Services:** Look for methods in `*service.ts` files that make HTTP calls (get, post, put, delete).
2.  **Resolve Models:** You are provided with 'Dependency' files containing interfaces. USE THEM to fill the tables.
3.  **No Guessing:** If a type is `unknown` or `any` in the code, verify if it is imported. If you can't find the definition in the provided context, state "Definition not available in context" instead of inventing fields.

STRICT FORMAT per Endpoint:
### `METHOD /url`
**Function:** `functionName`
**Request Body:** (`InterfaceName`)
| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| ...   | ...  | ...      | ...         |

**Response:** (`InterfaceName`)
| Field | Type | Description |
|-------|------|-------------|
| ...   | ...  | ...         |

---
"""
}
