
PROMPTS = {
    "root": """
You are a Senior Technical Writer.
TASK: Write a professional README.md for this project in Persian (Farsi).
Start with a high-level executive summary using the package.json and file structure.
Then list features, tech stack, and installation guide.
For every function or class name you mention, append source reference as [[Name:filePath:line]].
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

INSTRUCTIONS:
1. Focus on top-level reusable components/services/utilities used in this project.
2. Provide at least 10 concise examples when context permits.
3. Each example must include:
   - title
   - when to use
   - code block (tsx/ts/js/py as appropriate)
   - expected output/behavior
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
