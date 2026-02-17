import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import httpx
from analyzer import RepoAnalyzer
from prompts import PROMPTS
import os
import shutil
import tempfile
from git import Repo

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL STATE ---
# Store the active analyzer instance to allow /chat to access the analyzed repo
active_analyzer: Optional[RepoAnalyzer] = None

class GenerateRequest(BaseModel):
    repo_path: str
    selected_modules: Dict[str, bool]
    model_name: str
    base_url: str = "http://localhost:11434"

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]]
    model_name: str
    base_url: str = "http://localhost:11434"

class ReanalyzeRequest(BaseModel):
    file_path: str

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
                if ('-->' in s or '---' in s or '-.->' in s or '==>' in s or any(lower.startswith(p) for p in valid_graph_prefix)):
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
async def generate_docs(request: GenerateRequest):
    global active_analyzer
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
        analyzer.analyze()
        active_analyzer = analyzer # Save for Chat API
        
        # 2. Base Response with Stats and Graph
        response_data = {
            "stats": analyzer.get_project_stats(),
            "graph": analyzer.export_knowledge_graph(),
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

                full_prompt = f"{PROMPTS[module]}\n\nCONTEXT:\n{context}"
                
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
                    response_data["docParts"][module] = sanitize_mermaid(raw_text)

                except Exception as e:
                    response_data["docParts"][module] = f"Connection Error: {str(e)}"

        return response_data

    finally:
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    """
    RAG-enabled Chat Endpoint.
    Uses the 'active_analyzer' to find relevant code context.
    """
    global active_analyzer
    
    if not active_analyzer:
        raise HTTPException(status_code=400, detail="Repository not analyzed yet. Please run generation first.")

    # 1. Retrieve Context (Simple RAG)
    relevant_files = active_analyzer.search_context(request.message, limit=3)
    context_str = ""
    for score, path, content in relevant_files:
        context_str += f"\n--- FILE: {path} ---\n{content}\n"

    if not context_str:
        context_str = "No specific code files matched the query keywords. Answer generally or ask for clarification."

    # 2. Construct Prompt
    system_prompt = f"""You are a Senior Developer Assistant named 'Rayan'.
    Answer the user's question based strictly on the provided CODE CONTEXT.
    If the answer isn't in the code, say so.
    Output in Persian (Farsi).
    
    CODE CONTEXT:
    {context_str}
    """

    # 3. Call LLM
    base_url = request.base_url.rstrip('/')
    if base_url.endswith('/v1'): base_url = base_url[:-3]
    is_openai = ':1234' in base_url or '/v1' in request.base_url
    api_url = f"{base_url}/v1/chat/completions" if is_openai else f"{base_url}/api/generate"

    messages = [{"role": "system", "content": system_prompt}]
    # Add last few history items for continuity
    messages.extend([{"role": h["role"], "content": h["content"]} for h in request.history[-4:]])
    messages.append({"role": "user", "content": request.message})

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            payload = {}
            if is_openai:
                payload = {
                    "model": request.model_name,
                    "messages": messages,
                    "temperature": 0.3
                }
            else:
                # Ollama format conversion (simplified)
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

@app.post("/reanalyze")
async def reanalyze_file_endpoint(request: ReanalyzeRequest):
    global active_analyzer
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
        
        # Re-run dependency parsing for this specific file
        # Note: _parse_dependencies expects (rel_path, content, filename)
        filename = os.path.basename(full_path)
        active_analyzer._parse_dependencies(request.file_path, content, filename)
        
        # Return updated graph and stats
        return {
            "status": "success", 
            "graph": active_analyzer.export_knowledge_graph(),
            "stats": active_analyzer.get_project_stats()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("\n🚀 Rayan Backend is starting on http://localhost:8000")
    print("👉 Swagger UI: http://localhost:8000/docs\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
