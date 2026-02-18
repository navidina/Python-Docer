
# Rayan HamAfza Docs (رایان هم‌افزا مستندات)

**Intelligent Documentation Generator & Code Analysis Tool powered by Local LLMs (Ollama)**

Rayan HamAfza Docs is a modern React application designed to automatically generate comprehensive technical documentation for your software projects. It leverages local Large Language Models (LLMs) via Ollama to ensure data privacy and zero cost. Beyond simple documentation, it constructs a Knowledge Graph of your code, analyzes architecture, detects "Zombie Code", and provides a RAG-based chat interface to answer questions about your codebase.

![Rayan Docs Interface](https://via.placeholder.com/800x400?text=Rayan+Docs+Dashboard)

## Features

*   **Centralized Processing:** Backend ingests repositories once and stores vectorized code chunks in LanceDB for organization-wide reuse.
*   **Semantic Analysis:** parses code to understand classes, functions, and relationships.
*   **Knowledge Graph:** Visualizes dependencies between files and symbols.
*   **Architecture Analysis:** Detects architectural violations (e.g., UI directly accessing Database) and "Zombie" (dead) code.
*   **Automated Diagrams:** Generates Mermaid.js diagrams automatically:
    *   Entity Relationship Diagrams (ERD)
    *   Sequence Diagrams
    *   Class Diagrams
    *   Data Flow Diagrams
    *   User Journey & Use Cases
*   **RAG Chat:** Chat with your codebase using Retrieval-Augmented Generation.
*   **Playground:** Integrated JavaScript playground to test pure functions extracted from your code.

## Prerequisites

1.  **Node.js**: Version 18 or higher.
2.  **Ollama**: You must have Ollama installed and running locally.
    *   [Download Ollama](https://ollama.com/)
    *   **Models**: Pull a coding model and an embedding model.
        ```bash
        ollama pull qwen2.5-coder:14b
        ollama pull jina/jina-embeddings-v2-base-en
        ```

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-repo/rayan-docs.git
    cd rayan-docs
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm start
    ```

## Usage

### 1. Configure Ollama
Once the app is running (usually at `http://localhost:3000`), go to the **Settings** tab.
*   **Base URL**: Default is `http://localhost:11434`. Ensure Ollama is running with `ollama serve`.
*   **Models**: Enter the names of the models you pulled (e.g., `qwen2.5-coder:14b`).
*   **Persona**: Optionally define a persona (e.g., "Senior Security Engineer") to tailor the analysis.

### 2. Analyze a Project
Go to the **Dashboard**:
*   **Local Folder**: Click "Choose Files" and select your project's root folder.
*   **GitHub**: (Experimental) Enter a public `username/repo` URL.
*   Click **"Start Analysis"**.

### 3. Explore Documentation
Once processing is complete, navigate via the sidebar:
*   **Dashboard**: High-level stats, health check, and graph visualization.
*   **Architecture**: System design analysis.
*   **Code Analysis**: Detailed breakdown of every file with docstrings.
*   **Diagrams**: View auto-generated system diagrams.
*   **Chat**: Ask questions like "How does the authentication flow work?".


### 4. Centralized Ingestion (LanceDB)

When `/generate-docs` runs, backend now:
1. Scans and analyzes the full repository.
2. Builds semantic chunks (full files + entities).
3. Embeds and stores chunks in LanceDB (`shared_data/lancedb`).

Then `/chat` retrieves relevant chunks directly from LanceDB, and `/get-file` returns full file content from the knowledge base.

Embedding source is configurable via environment variables on backend:
- `EMBEDDING_BASE_URL` (default: `http://127.0.0.1:1234/v1`)
- `EMBEDDING_MODEL` (default: `text-embedding-all-minilm-l6-v2-embedding`)
- `EMBEDDING_ALLOW_LOCAL_FALLBACK` (default: `false`)

By default, backend will NOT fallback to local `sentence-transformers` if LM Studio is unreachable; it fails fast with a clear error so setup issues are explicit.
Set `EMBEDDING_ALLOW_LOCAL_FALLBACK=true` only if you intentionally want local fallback behavior.
The backend now uses the same `base_url` and `embeddingModel` provided by app settings/request payload when calling embedding APIs.
When embedding dimension differs from an existing LanceDB table schema, backend automatically routes writes/reads to a compatible dimension-specific table (e.g. `code_chunks_768d`) to avoid Arrow cast errors.

## Architecture Overview

The application is built with:
*   **Frontend**: React, TypeScript, Tailwind CSS.
*   **State Management**: React Hooks (Custom `useRepoProcessor`).
*   **Parsing**: Custom Regex-based tokenizer & Semantic Parser (`services/codeParser.ts`).
*   **Vector DB**: Centralized LanceDB (`backend/services/db_service.py`) for semantic retrieval and file serving.
*   **LLM Integration**: Direct fetch calls to local Ollama API.

## Troubleshooting

*   **CORS Errors**: If Ollama blocks the request, you may need to set the environment variable `OLLAMA_ORIGINS="*"`.
    *   Linux/Mac: `launchctl setenv OLLAMA_ORIGINS "*"` or run `OLLAMA_ORIGINS="*" ollama serve`.
    *   Windows: Set system environment variable.
*   **Slow Generation**: Use a smaller model (e.g., `qwen2.5-coder:7b`) or ensure you have GPU acceleration enabled in Ollama.

## License

MIT
