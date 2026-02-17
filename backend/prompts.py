
PROMPTS = {
    "root": """
Role: Senior Technical Writer (Persian Native Speaker).
TASK: Write a professional README.md strictly in PERSIAN (Farsi).

CRITICAL LANGUAGE RULE: 
- ALL explanations, summaries, and descriptions MUST be in Persian.
- Only keep technical terms (like React, Docker, API, JSON, Controller) in English.
- Do NOT write the introduction or headers in English.

Structure:
# [Project Name]
> [Executive Summary in Persian - 2 paragraphs]

## 🚀 ویژگی‌ها (Features)
- [Bullet points in Persian]

## 🛠 تکنولوژی‌ها (Tech Stack)
- [List]

## 🏗 معماری (Architecture)
[Explanation in Persian]
""",

    "setup": """
Role: DevOps Engineer & Technical Writer (Persian).
Task: Write a "Getting Started" guide based on 'package.json' and config files.

CRITICAL LANGUAGE RULE: Output MUST be in Persian (Farsi).

INSTRUCTIONS:
1. **Prerequisites**: List required tools (Node.js version, Python, Docker, etc.).
2. **Installation**: Show exact commands (`npm install`).
3. **Environment**: If `.env.example` exists, list key variables.

STRICT FORMAT (Persian):
## 🚀 راهنمای راه‌اندازی

### پیش‌نیازها
* ...

### نصب و اجرا
```bash
...
```

### متغیرهای محیطی (.env)
| متغیر | توضیح (فارسی) |
| --- | --- |
...
""",

    "arch": """
Role: Software Architect (Persian).
TASK: Analyze the file structure and dependencies.
Describe the architectural patterns used (MVC, Clean Arch, etc.) in PERSIAN.
Draw a 'graph TD' Mermaid diagram showing high-level module interactions.

CRITICAL: The text explanation MUST be in Persian. The Mermaid code stays in English.
""",

    "erd": """
Role: Database Architect.
Task: Create a Mermaid 'erDiagram'.
STRICT RULES:
1. Output ONLY the mermaid code block.
2. NO text descriptions outside the block.
""",

    "sequence": """
Role: System Architect.
Task: Create a Mermaid 'sequenceDiagram'.
CRITICAL: Output ONLY the mermaid code block.
""",

    "api": """
Role: API Developer.
Task: Create a Mermaid 'graph LR'.
CRITICAL: Output ONLY the mermaid code block.
""",

    "components": """
Role: Senior Frontend Developer (Persian).
Task: Create a "Component Library Reference" for the React components.

CRITICAL LANGUAGE RULE: ALL descriptions MUST be in PERSIAN.

INSTRUCTIONS:
1. **Analyze Props**: Look for `interface Props`.
2. **Document Each Prop**: Name, Type, Description (in Persian).

STRICT FORMAT:
## ComponentName
**توضیحات:** ... (به فارسی)
**Props:**
| ویژگی | نوع | الزامی | توضیحات (فارسی) |
|---|---|---|---|
| title | string | بله | عنوان کارت |

**مثال:**
```tsx
<ComponentName title="سلام" />
```
---
""",

    "api_ref": """
Role: Backend Developer (Persian).
Task: Create a detailed "API Reference" documentation in PERSIAN.

CRITICAL LANGUAGE RULE: Output MUST be in Persian.

INSTRUCTIONS:
1. **Endpoints**: For each service method, list the HTTP Method, URL.
2. **DTOs**: Expand interface definitions into tables with Persian descriptions.

STRICT FORMAT:
## سرویس کاربران (User Services)

### `GET /api/users`
* **عملکرد:** دریافت لیست کاربران
* **مدل درخواست:**
  | فیلد | نوع | توضیحات (فارسی) |
  |---|---|---|
  | page | number | شماره صفحه |
* **مدل پاسخ (`IUser`):**
  | فیلد | نوع | توضیحات (فارسی) |
  |---|---|---|
  | id | string | شناسه کاربر |

---
"""
}
