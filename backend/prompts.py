
PROMPTS = {
    "root": """
Role: Expert Technical Architect and Onboarding Writer.
Task: Write comprehensive project documentation in Persian (Farsi) for a newcomer developer.

MANDATORY SECTIONS (use exactly these headings):
1. ## خلاصه اجرایی (Executive Summary)
   - Explain what the project does and which frameworks/tools are used.
2. ## تکنولوژی‌ها و معماری (Tech Stack & Architecture)
   - Explain runtime stack, UI/backend architecture, state management approach (Redux/Zustand/Context/Query), and HTTP/client handling.
3. ## ساختار پوشه‌ها (Project Structure)
   - Provide a visual folder tree in a code block.
   - Then explain responsibilities of major directories (e.g., src/pages vs src/components vs core/services).
4. ## راهنمای نصب و اجرا (Getting Started)
   - Provide exact setup commands in order (install, dev, build, test if available).
   - Mention required environment variables and where to define them.
5. ## ویژگی‌های کلیدی (Key Features)
   - List key features and attach deep links to relevant files/components using [[Name:filePath:line]].

QUALITY RULES:
- This output must be pure Markdown and readable.
- Do NOT generate API lists or JSON in this section.
- Every technical claim should be grounded in provided context.
- For every function/class/component name you mention, append source reference as [[Name:filePath:line]].
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
For every function or class name you mention in prose, append [[Name:filePath:line]].

CRITICAL RULES FOR MERMAID DIAGRAMS:
1. DO NOT use comments (%%) inside any Mermaid code block.
2. Keep graph nodes/edges explicit and renderable.
""",

    "erd": """
Role: Database Architect.
Task: Create a Mermaid 'erDiagram'.
STRICT RULES:
- Output ONLY one mermaid code block.
- Use `erDiagram` syntax only.
- Model each entity with attribute rows in this exact format: `<type> <fieldName> [PK|FK|UK]`.
- Always include primary keys (`PK`) and foreign keys (`FK`) when inferable.
- Prefer business-friendly table names (PascalCase, no spaces).
- Add relation labels (e.g. `has_many`, `belongs_to`, `contains`, `generated_from`).
- Use explicit cardinality markers (`||--o{`, `||--||`, `|o--o{`, ...).
- Keep layout readable: start with core entities, then join/bridge tables.
- CRITICAL: DO NOT use comments (%%). Print all attributes directly.

QUALITY TARGET (visual structure similar to professional DB diagrams):
1) Entity header + typed columns
2) PK/FK markers visible on rows
3) Clear crow's-foot relationships with labels
4) Avoid noisy or duplicate entities

Template example (style reference):
```mermaid
erDiagram
  User {
    string userId PK
    string username UK
    string mobileNumber
    boolean active
  }
  Application {
    string applicationId PK
    string ownerUserId FK
    string name
    boolean active
  }
  AccessRequest {
    string requestId PK
    string applicationId FK
    string submittedByUserId FK
    string status
  }

  User ||--o{ Application : owns
  User ||--o{ AccessRequest : submits
  Application ||--o{ AccessRequest : has_requests
```
""",

    "sequence": """
Role: System Architect.
Task: Create a Mermaid 'sequenceDiagram' for CORE BUSINESS LOGIC.
Use real method names found in the code. Output ONLY the mermaid code block.

CRITICAL RULES FOR MERMAID DIAGRAMS:
1. DO NOT use comments (%%) inside Mermaid output.
2. Ensure all `alt/else/end` blocks are fully valid and complete.
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
For every component name and imported type, append [[Name:filePath:line]].

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
Role: Senior Backend Architect.
Task: Analyze the provided code and extract API definitions into a strict JSON format complying with a simplified OpenAPI 3.0 shape.

CONTEXT:
You have controllers/services and related dependency files (DTOs/Interfaces/Types).

INSTRUCTIONS:
1. Identify all HTTP endpoints (GET, POST, PUT, PATCH, DELETE).
2. Resolve request/response types fully from dependency files.
3. For responses, if return type is implicit, infer from HTTP generic calls such as http.get<T>(), http.post<T>(), Promise<T>, Observable<T>.
4. If a field type references another interface/type, expand it inline recursively when possible.
5. `source` MUST always be in exact format [[functionName:filePath:line]] (line is required).
6. If a definition is missing, keep field type as "unknown" and set desc to "Definition not available in context".
7. Add `requestExample`, `responseExample`, and `errorResponses` when possible.
8. Output PURE JSON only (no Markdown, no backticks, no explanations).

JSON STRUCTURE:
{
  "endpoints": [
    {
      "method": "POST",
      "path": "/api/users",
      "summary": "Create a user",
      "source": "[[functionName:filePath:line]]",
      "requestBody": {
        "fields": [
          {"name": "username", "type": "string", "required": true, "desc": "Unique handle"}
        ]
      },
      "requestExample": {
        "username": "omid"
      },
      "response": {
        "fields": [
          {"name": "id", "type": "string", "required": true, "desc": "Generated id"}
        ]
      },
      "responseExample": {
        "id": "usr_123"
      },
      "errorResponses": [
        {
          "status": 400,
          "code": "VALIDATION_ERROR",
          "message": "username is required",
          "example": {"error": "VALIDATION_ERROR"}
        }
      ]
    }
  ]
}
""",

    "examples": """
Role: Senior Developer Advocate.
Task: Create a practical "How to use" guide in Persian with concrete code examples.

CRITICAL LANGUAGE RULES:
- All narrative text MUST be Persian (Farsi): titles, descriptions, when-to-use, expected behavior.
- Do NOT write English paragraphs/sentences except code syntax, identifiers, and library names.
- Keep only actual executable code inside fenced code blocks.
- Never wrap whole documentation text in a ts/tsx code fence.

INSTRUCTIONS:
1. Focus on top-level reusable components/services/utilities used in this project.
2. Provide at least 10 concise examples when context permits.
3. Each example must include:
   - title (Persian)
   - when to use (Persian)
   - code block (tsx/ts/js/py as appropriate, code only)
   - expected output/behavior (Persian)
4. Add source references in prose as [[Name:filePath:line]].
5. Prefer copy-paste-ready snippets.
""",

    "testing": """
Role: Senior QA Engineer.
Task: Write a complete testing guide in Persian.

REQUIRED SECTIONS:
- Testing strategy (Unit / Integration / E2E)
- Folder/file naming conventions for tests
- How to run tests locally and in CI
- Example Unit Test (realistic)
- Example Integration Test (realistic)
- Example E2E Test (realistic)
- Mocking and test-data guidelines
- Common pitfalls and debugging tips

INSTRUCTIONS:
- Use actual project technologies inferred from context.
- Include runnable code snippets.
- Mention source references as [[Name:filePath:line]] where possible.
"""
}
