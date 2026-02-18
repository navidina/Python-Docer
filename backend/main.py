import re
import json
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import httpx
from analyzer import RepoAnalyzer
from prompts import PROMPTS
from services.db_service import VectorDBService
import os
import shutil
import tempfile
from git import Repo

app = FastAPI()

SAFE_CONTEXT_LIMITS = {
    "api_ref": 60000,
    "components": 50000,
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL STATE ---
# Store the active analyzer instance to allow /chat to access the analyzed repo
active_analyzer: Optional[RepoAnalyzer] = None
active_doc_parts: Dict[str, str] = {}
active_repo_id: Optional[str] = None
db_service = VectorDBService()

CACHE_FILE = os.path.join("data", "latest_docs.json")
os.makedirs("data", exist_ok=True)


def normalize_api_ref_links(raw_text: str, analyzer: Optional[RepoAnalyzer]) -> str:
    """
    Ensure api_ref `source` links follow [[name:file:line]] format.
    If line is missing, resolve it from analyzer graph metadata when possible.
    """
    if not raw_text or not analyzer:
        return raw_text

    try:
        payload = json.loads(raw_text)
    except Exception:
        return raw_text

    endpoints = payload.get("endpoints")
    if not isinstance(endpoints, list):
        return raw_text

    symbol_lines = {}
    for node, attrs in analyzer.graph.nodes(data=True):
        if attrs.get('type') != 'entity':
            continue
        name = attrs.get('name')
        file_path = attrs.get('filePath')
        line = attrs.get('line')
        if isinstance(name, str) and isinstance(file_path, str) and isinstance(line, int):
            symbol_lines[(name, file_path)] = line

    source_pattern = re.compile(r'^\[\[([^:\]]+):([^:\]]+)(?::(\d+))?\]\]$')

    for ep in endpoints:
        if not isinstance(ep, dict):
            continue
        source = ep.get("source")
        if not isinstance(source, str):
            continue

        m = source_pattern.match(source.strip())
        if not m:
            continue

        name, file_path, line = m.group(1), m.group(2), m.group(3)
        if line:
            continue

        resolved_line = symbol_lines.get((name, file_path))
        if resolved_line is not None:
            ep["source"] = f"[[{name}:{file_path}:{resolved_line}]]"

    try:
        return json.dumps(payload, ensure_ascii=False, indent=2)
    except Exception:
        return raw_text

class GenerateRequest(BaseModel):
    repo_path: str
    selected_modules: Dict[str, bool]
    model_name: str
    base_url: str = "http://localhost:11434"
    embedding_model: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]]
    model_name: str
    base_url: str = "http://localhost:11434"
    doc_parts: Optional[Dict[str, str]] = None

class ReanalyzeRequest(BaseModel):
    file_path: str

class GetFileRequest(BaseModel):
    path: str



def _ingest_repo_in_background(analyzer: RepoAnalyzer):
    """Background LanceDB ingestion for chat retrieval; keeps doc generation graph-first."""
    try:
        ingest_meta = analyzer.ingest_current_state(replace_existing=True)
        print(f"Ingestion completed in background: {ingest_meta}")
    except Exception as exc:
        print(f"Background ingestion failed: {exc}")

def sanitize_mermaid(markdown_text: str) -> str:
    """Normalize Mermaid blocks to reduce syntax errors from LLM output noise."""
    block_pattern = re.compile(r'```mermaid\s*(.*?)```', re.DOTALL | re.IGNORECASE)

    def normalize_block(raw_block: str) -> str:
        lines = [line.rstrip() for line in raw_block.strip().splitlines()]
        if not lines:
            return ""

        lines = [line for line in lines if not line.strip().startswith('```')]
        if not lines:
            return ""

        valid_starts = (
            'graph', 'flowchart', 'sequencediagram', 'classdiagram', 'statediagram',
            'erdiagram', 'journey', 'gantt', 'mindmap', 'timeline', 'quadrantchart', 'pie'
        )

        start_idx = 0
        for i, line in enumerate(lines):
            normalized = line.strip().lower().replace(' ', '')
            if any(normalized.startswith(s) for s in valid_starts):
                start_idx = i
                break

        lines = lines[start_idx:]
        if not lines:
            return ""

        first = lines[0].strip()
        first_norm = first.lower().replace(' ', '')
        is_sequence = first_norm.startswith('sequencediagram')
        is_graph = first_norm.startswith('graph') or first_norm.startswith('flowchart')
        is_erd = first_norm.startswith('erdiagram')

        cleaned = [first]
        if is_sequence:
            valid_seq_prefix = (
                'participant', 'actor', 'note', 'loop', 'end', 'alt', 'opt', 'par',
                'and', 'critical', 'break', 'rect', 'activate', 'deactivate', 'autonumber', 'title'
            )
            for line in lines[1:]:
                s = line.strip()
                lower = s.lower()
                if not s:
                    continue
                if lower in {'tb', 'td', 'lr', 'rl', 'bt'}:
                    cleaned.append(f"%% {line}")
                    continue
                if ('->' in s or '--' in s or any(lower.startswith(p) for p in valid_seq_prefix) or s.startswith('%%')):
                    cleaned.append(line)
                else:
                    cleaned.append(f"%% {line}")
        elif is_graph:
            valid_graph_prefix = ('subgraph', 'end', 'classdef', 'class', 'style', 'linkstyle', 'click', '%%')
            for line in lines[1:]:
                s = line.strip()
                lower = s.lower()
                if not s:
                    continue
                # LLM often injects bracketed file tags that break Mermaid parse.
                if s.startswith('[') and s.endswith(']'):
                    cleaned.append(f"%% {line}")
                    continue
                if ('-->' in s or '---' in s or '-.->' in s or '==>' in s or any(lower.startswith(p) for p in valid_graph_prefix)):
                    cleaned.append(line)
                else:
                    cleaned.append(f"%% {line}")
        elif is_erd:
            # ER diagram supports a narrower grammar. Comment-out noisy flowchart/class lines.
            valid_erd_prefix = ('title', 'direction', '%%')
            rel_markers = ('||--', '|o--', 'o|--', '}|--', '|{--', '}o--', 'o{--', '}|..', '|{..')
            for line in lines[1:]:
                s = line.strip()
                lower = s.lower()
                if not s:
                    continue
                if lower.startswith('classdef') or lower.startswith('class ') or lower.startswith('style '):
                    cleaned.append(f"%% {line}")
                    continue
                if any(m in s for m in rel_markers) or '{' in s or '}' in s or any(lower.startswith(p) for p in valid_erd_prefix):
                    cleaned.append(line)
                else:
                    cleaned.append(f"%% {line}")
        else:
            cleaned.extend(lines[1:])

        return "\n".join(cleaned)

    def replace_block(match: re.Match) -> str:
        fixed = normalize_block(match.group(1))
        if fixed:
            return f"```mermaid\n{fixed}\n```"
        return "```mermaid\n%% Empty diagram\n```"

    return block_pattern.sub(replace_block, markdown_text)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Rayan Backend is running"}

@app.post("/generate-docs")
async def generate_docs(request: GenerateRequest, background_tasks: BackgroundTasks):
    global active_analyzer, active_doc_parts, active_repo_id
    results = {}
    work_dir = request.repo_path
    temp_dir = None

    if request.repo_path.startswith(("http://", "https://", "git@")):
        try:
            temp_dir = tempfile.mkdtemp()
            Repo.clone_from(request.repo_path, temp_dir, depth=1)
            work_dir = temp_dir
        except Exception as e:
            if temp_dir: shutil.rmtree(temp_dir, ignore_errors=True)
            raise HTTPException(status_code=400, detail=f"Git clone failed: {str(e)}")
    
    elif not os.path.exists(work_dir):
        raise HTTPException(status_code=400, detail="Repository path not found.")

    try:
        # 1. Analyze and Store Globally
        print(f"Analyzing repo: {work_dir}")
        analyzer = RepoAnalyzer(work_dir)
        analyzer.db_service.configure_embedding(base_url=request.base_url, model=request.embedding_model)
        db_service.configure_embedding(base_url=request.base_url, model=request.embedding_model)

        # Graph-first analysis for high-quality documentation generation.
        analyzer.analyze()
        active_analyzer = analyzer
        active_repo_id = analyzer.repo_id

        # LanceDB ingestion is done in background for chat usage.
        background_tasks.add_task(_ingest_repo_in_background, analyzer)
        
        # 2. Base Response with Stats and Graph
        response_data = {
            "stats": analyzer.get_project_stats(),
            "graph": analyzer.export_knowledge_graph(),
            "codeHealth": analyzer.get_code_health(),
            "docParts": {}
        }

        # 3. Generate Docs with LLM
        base_url = request.base_url.rstrip('/')
        if base_url.endswith('/v1'): base_url = base_url[:-3]
        is_openai = ':1234' in base_url or '/v1' in request.base_url
        api_url = f"{base_url}/v1/chat/completions" if is_openai else f"{base_url}/api/generate"

        async with httpx.AsyncClient(timeout=600.0) as client:
            for module, is_selected in request.selected_modules.items():
                if not is_selected or module not in PROMPTS: continue

                context = analyzer.get_context(module)
                if not context:
                    response_data["docParts"][module] = "INFO: No relevant files found for this module."
                    continue

                safe_limit = SAFE_CONTEXT_LIMITS.get(module, 70000)
                safe_context = context[:safe_limit]
                full_prompt = f"{PROMPTS[module]}\n\nCONTEXT:\n{safe_context}"
                
                try:
                    payload = {}
                    if is_openai:
                        payload = {
                            "model": request.model_name,
                            "messages": [{"role": "system", "content": "You are a technical writer. OUTPUT CODE."}, {"role": "user", "content": full_prompt}],
                            "temperature": 0.1
                        }
                    else:
                        payload = {"model": request.model_name, "prompt": full_prompt, "stream": False, "options": {"num_ctx": 32768}}

                    resp = await client.post(api_url, json=payload)
                    if resp.status_code != 200:
                        response_data["docParts"][module] = f"Error: {resp.text}"
                        continue
                        
                    data = resp.json()
                    raw_text = data.get('choices', [{}])[0].get('message', {}).get('content', '') if is_openai else data.get('response', '')
                    normalized_text = sanitize_mermaid(raw_text)
                    if module == 'api_ref':
                        normalized_text = normalize_api_ref_links(normalized_text, analyzer)
                    response_data["docParts"][module] = normalized_text

                except Exception as e:
                    # Retry once with an aggressively smaller prompt for unstable local endpoints.
                    retry_context = context[:30000]
                    retry_prompt = f"{PROMPTS[module]}\n\nCONTEXT:\n{retry_context}"
                    try:
                        retry_payload = {}
                        if is_openai:
                            retry_payload = {
                                "model": request.model_name,
                                "messages": [
                                    {"role": "system", "content": "You are a technical writer. OUTPUT CODE."},
                                    {"role": "user", "content": retry_prompt}
                                ],
                                "temperature": 0.1
                            }
                        else:
                            retry_payload = {
                                "model": request.model_name,
                                "prompt": retry_prompt,
                                "stream": False,
                                "options": {"num_ctx": 16384}
                            }

                        retry_resp = await client.post(api_url, json=retry_payload)
                        if retry_resp.status_code == 200:
                            retry_data = retry_resp.json()
                            retry_text = retry_data.get('choices', [{}])[0].get('message', {}).get('content', '') if is_openai else retry_data.get('response', '')
                            normalized_retry_text = sanitize_mermaid(retry_text)
                            if module == 'api_ref':
                                normalized_retry_text = normalize_api_ref_links(normalized_retry_text, analyzer)
                            response_data["docParts"][module] = normalized_retry_text
                        else:
                            response_data["docParts"][module] = f"Connection Error: {str(e)} | Retry failed: {retry_resp.text}"
                    except Exception as retry_error:
                        response_data["docParts"][module] = f"Connection Error: {str(e)} | Retry failed: {str(retry_error)}"

        active_doc_parts = response_data.get("docParts", {})

        cache_payload = {
            **response_data,
            "repoPath": work_dir,
            "sourceRepoPath": request.repo_path,
            "repoId": active_repo_id,
        }
        try:
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(cache_payload, f, ensure_ascii=False)
        except Exception as cache_exc:
            print(f"Warning: failed to persist latest docs cache: {cache_exc}")

        return response_data

    finally:
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)


@app.get("/latest-docs")
async def get_latest_docs():
    global active_analyzer, active_doc_parts, active_repo_id

    if not os.path.exists(CACHE_FILE):
        raise HTTPException(status_code=404, detail="No documentation generated yet")

    try:
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Restore in-memory fast paths for chat/get-file after server restart.
        if isinstance(data.get("docParts"), dict):
            active_doc_parts = data["docParts"]

        repo_id = data.get("repoId")
        if isinstance(repo_id, str) and repo_id:
            active_repo_id = repo_id

        repo_path = data.get("repoPath")
        if active_analyzer is None and isinstance(repo_path, str) and os.path.exists(repo_path):
            restored = RepoAnalyzer(repo_path)
            restored.analyze()
            active_analyzer = restored
            if not active_repo_id:
                active_repo_id = restored.repo_id

        return data
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load latest docs: {exc}")


@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    """
    RAG-enabled Chat Endpoint.
    Uses centralized LanceDB retrieval + generated documentation parts.
    """
    global active_doc_parts, active_repo_id

    if not active_repo_id:
        raise HTTPException(status_code=400, detail="Repository not analyzed yet. Please run generation first.")

    # 1) Code-context retrieval from LanceDB
    relevant_chunks = db_service.search(request.message, repo_id=active_repo_id, limit=6)
    code_context = ""
    for chunk in relevant_chunks:
        score = chunk.get('_distance', 'n/a')
        code_context += (
            f"\n--- FILE: {chunk.get('file_path', 'unknown')} "
            f"(line={chunk.get('start_line', 1)}, distance={score}) ---\n"
            f"{chunk.get('text', '')[:2200]}\n"
        )

    # 2) Documentation-context retrieval
    docs_source = request.doc_parts if request.doc_parts else active_doc_parts
    doc_context = ""
    if docs_source:
        query_tokens = [t for t in re.split(r"[^a-zA-Z0-9_؀-ۿ]+", request.message.lower()) if len(t) > 2]
        scored = []
        for section, text in docs_source.items():
            if not text:
                continue
            score = sum(text.lower().count(tok) for tok in query_tokens)
            score += 4 if section.lower() in request.message.lower() else 0
            scored.append((score, section, text))
        scored.sort(key=lambda x: x[0], reverse=True)
        for _, section, text in scored[:3]:
            doc_context += f"\n--- DOC SECTION: {section} ---\n{text[:3500]}\n"

    if not code_context:
        code_context = "No specific code chunks matched query keywords in LanceDB."
    if not doc_context:
        doc_context = "No documentation sections matched query keywords."

    # 3) Construct Prompt
    system_prompt = f"""You are a Senior Developer Assistant named 'Rayan'.
    Answer the user's question based strictly on provided CODE CONTEXT and DOCUMENTATION CONTEXT.
    Prioritize project-specific, actionable and deep answers (architecture, APIs, flows, setup steps, data models).
    If information is missing, say exactly what file/section is missing.
    Output in Persian (Farsi).

    CODE CONTEXT:
    {code_context}

    DOCUMENTATION CONTEXT:
    {doc_context}
    """

    # 4) Call LLM
    base_url = request.base_url.rstrip('/')
    if base_url.endswith('/v1'): base_url = base_url[:-3]
    is_openai = ':1234' in base_url or '/v1' in request.base_url
    api_url = f"{base_url}/v1/chat/completions" if is_openai else f"{base_url}/api/generate"

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend([{"role": h["role"], "content": h["content"]} for h in request.history[-6:]])
    messages.append({"role": "user", "content": request.message})

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            payload = {}
            if is_openai:
                payload = {
                    "model": request.model_name,
                    "messages": messages,
                    "temperature": 0.2
                }
            else:
                full_prompt = f"System: {system_prompt}\n"
                for m in messages[1:]:
                    full_prompt += f"{m['role']}: {m['content']}\n"
                payload = {"model": request.model_name, "prompt": full_prompt, "stream": False}

            resp = await client.post(api_url, json=payload)
            if resp.status_code != 200:
                return {"response": f"Error from LLM: {resp.text}"}

            data = resp.json()
            answer = data.get('choices', [{}])[0].get('message', {}).get('content', '') if is_openai else data.get('response', '')
            return {"response": answer}

    except Exception as e:
        return {"response": f"Internal Error: {str(e)}"}


@app.post("/get-file")
async def get_file_endpoint(request: GetFileRequest):
    global active_repo_id, active_analyzer

    if active_analyzer and request.path in active_analyzer.file_map:
        return {"path": request.path, "content": active_analyzer.file_map[request.path]}

    if not active_repo_id:
        raise HTTPException(status_code=400, detail="Repository not analyzed yet. Please run generation first.")

    content = db_service.get_file_content(request.path, repo_id=active_repo_id)
    if content is None:
        raise HTTPException(status_code=404, detail="File not found")

    return {"path": request.path, "content": content}

@app.post("/reanalyze")
async def reanalyze_file_endpoint(request: ReanalyzeRequest):
    global active_analyzer, active_repo_id
    if not active_analyzer:
        raise HTTPException(status_code=400, detail="Repository not analyzed yet.")
    
    # Construct full path safely
    # active_analyzer.repo_path is the root. request.file_path is relative.
    full_path = os.path.join(active_analyzer.repo_path, request.file_path)
    
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            
        # Update content in file_map
        active_analyzer.file_map[request.file_path] = content
        
        # Rebuild analyzer graph for documentation quality, then refresh LanceDB index
        active_analyzer.analyze()
        ingest_meta = active_analyzer.ingest_current_state(replace_existing=True)
        active_repo_id = ingest_meta.get("repo_id")

        # Return updated graph and stats
        return {
            "status": "success",
            "graph": active_analyzer.export_knowledge_graph(),
            "stats": active_analyzer.get_project_stats(),
            "codeHealth": active_analyzer.get_code_health(),
            "ingestion": ingest_meta,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("\n🚀 Rayan Backend is starting on http://localhost:8000")
    print("👉 Swagger UI: http://localhost:8000/docs\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
