PROMPTS = {
    "root": """
You are a Senior Technical Writer.
TASK: Write a professional README.md for this project.
Start with a high-level executive summary using the package.json and file structure.
Then list features, tech stack, and installation guide.
Output in Persian (Farsi).
""",

    "arch": """
You are a Software Architect.
TASK: Analyze the file structure and dependencies.
Describe the architectural patterns used (MVC, Clean Arch, etc.).
Draw a 'graph TD' Mermaid diagram showing high-level module interactions.
Output in Persian.
""",

    "erd": """
Role: Database Architect.
Task: Create a Mermaid 'erDiagram' based on the entities found.
STRICT RULES:
1. Output ONLY the mermaid code block.
2. NO text descriptions outside the block.
3. Use simple entity names (e.g., User, Order).
""",

    "sequence": """
Role: System Architect.
Task: Create a Mermaid 'sequenceDiagram' for the main flows.
CRITICAL SYNTAX RULES:
1. You MUST put double quotes around ALL message texts.
   - CORRECT: User->>API: "Login Request"
   - WRONG: User->>API: Login Request
2. You MUST put double quotes around ALL participants if they have spaces.
   - CORRECT: participant US as "User Service"
3. Use 'autonumber'.
4. Output ONLY the mermaid code block.
""",

    "api": """
Role: API Developer.
Task: Create a Mermaid 'graph LR' showing API endpoints.
CRITICAL SYNTAX RULES:
1. Put quotes around node labels: A["User Controller"]
2. Put quotes around edge labels: A -->|"/login"| B
3. Output ONLY the mermaid code block.
""",

    "components": """
Role: Senior Frontend Developer & Technical Writer.
Task: Create a "Component Library Reference" for the provided React components.

INSTRUCTIONS:
1. For each MAJOR component found in the context:
   - **Name**: Component Name.
   - **Description**: What does it do? (Infer from code/comments).
   - **Props Table**: Create a Markdown table with columns: `Prop Name`, `Type`, `Required?`, `Description`.
   - **Usage Example**: Write a short code block showing how to use this component.

STRICT FORMAT:
## ComponentName
**Description:** ...
**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| ...  | ...  | ...      | ...         |

**Example:**
```tsx
<ComponentName ... />
```
---
""",

    "api_ref": """
Role: Backend Developer & API Specialist.
Task: Create an "API Reference" documentation based on the service files.

INSTRUCTIONS:
1. Analyze the provided Service/API files.
2. Extract every HTTP call (GET, POST, PUT, DELETE).
3. For each endpoint, generate:
   - **Method**: (GET/POST/...)
   - **Endpoint URL**: (e.g., `/api/users`)
   - **Function Name**: The TS function calling it.
   - **Payload/Params**: What data is sent?
   - **Response**: What data is expected (Type/Interface)?

STRICT FORMAT:
## User Services (Grouping)

### `GET /api/users`
* **Function:** `getUsers()`
* **Params:** `page`, `limit`
* **Response:** `User[]`
* **Auth Required:** Yes (Inferred)

---
"""
}
