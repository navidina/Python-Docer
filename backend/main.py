import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
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

class GenerateRequest(BaseModel):
    repo_path: str
    selected_modules: Dict[str, bool]  # e.g., {"root": true, "erd": false}
    model_name: str
    base_url: str = "http://localhost:11434" # Default to local Ollama

def sanitize_mermaid(markdown_text: str) -> str:
    """
    Fix common Mermaid syntax errors in LLM output.
    1. Filter invalid lines in Sequence Diagrams (remove hallucinations).
    2. Enforce quotes on labels and messages.
    """
    
    # Extract blocks to process
    mermaid_blocks = re.findall(r'```mermaid(.*?)```', markdown_text, re.DOTALL)
    
    for original_block in mermaid_blocks:
        lines = original_block.strip().split('\n')
        if not lines: continue
        
        # Detect Diagram Type
        is_sequence = any('sequencediagram' in line.lower().replace(' ', '') for line in lines[:2])
        is_flowchart = any(x in lines[0].lower() for x in ['graph', 'flowchart'])
        
        fixed_lines = []
        for line in lines:
            line = line.strip()
            if not line: continue
            
            # Remove Markdown fences if caught inside
            if line.startswith('```'): continue

            # --- SEQUENCE DIAGRAM FIXES ---
            if is_sequence:
                # 1. Filter out lines that are clearly not Mermaid syntax (Hallucinations)
                # Valid starts: participant, actor, note, loop, end, alt, opt, rect, autonumber, activate, deactivate, or an arrow relation
                valid_keywords = ('sequenceDiagram', 'participant', 'actor', 'note', 'loop', 'end', 'alt', 'else', 'opt', 'rect', 'autonumber', 'activate', 'deactivate', 'par', 'critical', 'break')
                
                # Check for arrow
                has_arrow = ('->' in line or '--' in line)
                
                first_word = line.split(' ')[0]
                # If line doesn't start with keyword AND has no arrow, it's likely garbage text.
                if not has_arrow and first_word not in valid_keywords:
                    # Comment it out so mermaid ignores it
                    line = f"%% Ignored: {line}"
                
                # 2. Fix Quotes on Messages: A ->> B: Message content
                if ':' in line and has_arrow:
                    parts = line.split(':', 1)
                    left_side = parts[0]
                    message = parts[1].strip()
                    
                    # If message is not empty and not quoted, quote it
                    if message and not (message.startswith('"') or message.startswith("'")):
                        # Escape existing quotes
                        message = message.replace('"', "'")
                        line = f'{left_side}: "{message}"'
                
                # 3. Fix Quotes on Participants: participant A as Name
                if line.startswith('participant '):
                    if ' as ' in line:
                        parts = line.split(' as ', 1)
                        if not (parts[1].strip().startswith('"') or parts[1].strip().startswith("'")):
                             line = f'{parts[0]} as "{parts[1].strip()}"'

            # --- FLOWCHART / GRAPH FIXES ---
            if is_flowchart:
                # Fix: A[Text with space] -> A["Text with space"]
                # Regex looks for brackets [], (), {}, >] that contain spaces but no quotes
                def quote_label(match):
                    opener, content, closer = match.groups()
                    if ' ' in content and not content.startswith('"') and not content.startswith("'"):
                         content = content.replace('"', "'")
                         return f'{opener}"{content}"{closer}'
                    return match.group(0)
                
                line = re.sub(r'(\[|\(|\{)([^\n"\]\)\}]+)(\]|\)|\})', quote_label, line)

            fixed_lines.append(line)
            
        fixed_block = '\n'.join(fixed_lines)
        
        # Replace only the content inside the backticks
        markdown_text = markdown_text.replace(original_block, f"\n{fixed_block}\n")

    return markdown_text

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

    analyzer = None
    try:
        # 1. Analyze Project
        print(f"Analyzing repo: {work_dir}")
        try:
            analyzer = RepoAnalyzer(work_dir)
            analyzer.analyze()
            
            # Check if any files were found
            if not analyzer.file_map:
                raise HTTPException(status_code=400, detail="No supported code files found in the directory.")
                
            print(f"Analysis complete. Found {len(analyzer.file_map)} files.")
            
        except Exception as e:
            print(f"Analysis failed: {e}")
            raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

        # Configure LLM Client
        # Clean base URL
        base_url = request.base_url.rstrip('/')
        if base_url.endswith('/v1'):
            base_url = base_url[:-3]
            
        # Heuristic to detect LM Studio / OpenAI compatible endpoints (usually port 1234 or explicit v1)
        is_openai_format = ':1234' in base_url or '/v1' in request.base_url
        
        api_url = f"{base_url}/v1/chat/completions" if is_openai_format else f"{base_url}/api/generate"
        print(f"Connecting to LLM at: {api_url} (Format: {'OpenAI/LM Studio' if is_openai_format else 'Ollama'})")

        async with httpx.AsyncClient(timeout=300.0) as client:
            # 2. Generate Modules
            for module, is_selected in request.selected_modules.items():
                if not is_selected or module not in PROMPTS:
                    continue

                print(f"Generating {module}...")

                # Get context
                context = analyzer.get_context(module)
                if not context:
                    # Use a long message so the frontend treats it as 'Done' (Green) rather than 'Pending' (Gray)
                    results[module] = f"INFO: No specific files were found in the codebase matching the criteria for the '{module}' module. This section requires files to follow standard naming conventions (e.g., .tsx for Components, or 'service/api' keywords for API Ref)."
                    continue
                    
                prompt_text = PROMPTS[module]
                full_prompt = f"{prompt_text}\n\nCONTEXT:\n{context}"

                # Request to LLM
                try:
                    payload = {}
                    if is_openai_format:
                        # OpenAI / LM Studio Format
                        payload = {
                            "model": request.model_name,
                            "messages": [
                                {"role": "system", "content": "You are a helpful technical writer and architect. OUTPUT ONLY CODE."},
                                {"role": "user", "content": full_prompt}
                            ],
                            "stream": False,
                            "max_tokens": 8192,
                            "temperature": 0.1 
                        }
                    else:
                        # Ollama Format
                        payload = {
                            "model": request.model_name,
                            "prompt": full_prompt,
                            "stream": False,
                            "options": {
                                "num_ctx": 32768,
                                "temperature": 0.1
                            }
                        }

                    response = await client.post(api_url, json=payload)
                    
                    if response.status_code != 200:
                        error_msg = f"LLM Error ({response.status_code}): {response.text}"
                        print(error_msg)
                        results[module] = error_msg
                        continue

                    data = response.json()
                    content = ""
                    
                    if is_openai_format:
                        content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                    else:
                        content = data.get('response', '')

                    if not content:
                         results[module] = "Empty response"
                    else:
                         # Apply Mermaid Sanitizer
                         cleaned_content = sanitize_mermaid(content)
                         results[module] = cleaned_content
                        
                except Exception as e:
                    print(f"Error calling LLM for {module}: {e}")
                    results[module] = f"Connection Error: {str(e)}"

    finally:
        # Cleanup temp dir if it was created
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception as e:
                print(f"Warning: Failed to cleanup temp dir {temp_dir}: {e}")

    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
