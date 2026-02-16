from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List
import httpx
from analyzer import RepoAnalyzer
from prompts import PROMPTS
import os
import shutil
import tempfile
from git import Repo

app = FastAPI()

# CORS settings for React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ollama Configuration
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "qwen2.5-coder:14b"


class GenerateRequest(BaseModel):
    repo_path: str
    selected_modules: Dict[str, bool]  # e.g., {"root": true, "erd": false}
    model_name: str = MODEL_NAME


@app.post("/generate-docs")
async def generate_docs(request: GenerateRequest):
    results = {}
    work_dir = request.repo_path
    temp_dir = None

    # Handle GitHub URLs
    if request.repo_path.startswith(("http://", "https://", "git@")):
        print(f"Cloning GitHub repo: {request.repo_path}")
        try:
            temp_dir = tempfile.mkdtemp()
            Repo.clone_from(request.repo_path, temp_dir, depth=1)
            work_dir = temp_dir
        except Exception as e:
            if temp_dir:
                shutil.rmtree(temp_dir, ignore_errors=True)
            raise HTTPException(status_code=400, detail=f"Git clone failed: {str(e)}")
    
    elif not os.path.exists(work_dir):
        raise HTTPException(status_code=400, detail="Repository path not found.")

    try:
        # 1. Analyze Project
        print(f"Analyzing repo: {work_dir}")
        try:
            analyzer = RepoAnalyzer(work_dir)
            analyzer.analyze()
        except Exception as e:
            print(f"Analysis failed: {e}")
            raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

        async with httpx.AsyncClient(timeout=300.0) as client:
            # 2. Generate Modules
            for module, is_selected in request.selected_modules.items():
                if not is_selected or module not in PROMPTS:
                    continue

                print(f"Generating {module}...")

                # Get context
                context = analyzer.get_context(module)
                prompt_text = PROMPTS[module]

                full_prompt = f"{prompt_text}\n\nCONTEXT:\n{context}"

                # Request to Ollama
                try:
                    response = await client.post(OLLAMA_URL, json={
                        "model": request.model_name or MODEL_NAME,
                        "prompt": full_prompt,
                        "stream": False,
                        "options": {
                            "num_ctx": 32768
                        }
                    })
                    if response.status_code != 200:
                        results[module] = f"Ollama Error: {response.text}"
                        continue

                    data = response.json()
                    results[module] = data.get('response', 'Error generating')
                except Exception as e:
                    print(f"Error calling LLM for {module}: {e}")
                    results[module] = f"Error: {str(e)}"

    finally:
        # Cleanup temp dir if it was created
        if temp_dir and os.path.exists(temp_dir):
            try:
                # Use ignore_errors=True because on Windows git processes might hold locks briefly
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception as e:
                print(f"Warning: Failed to cleanup temp dir {temp_dir}: {e}")

    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
