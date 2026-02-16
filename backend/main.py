from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List
import httpx
from analyzer import RepoAnalyzer
from prompts import PROMPTS
import os

app = FastAPI()

# تنظیمات CORS برای ارتباط با React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# کانفیگ Ollama
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "qwen2.5-coder:14b" # مدل پیش‌فرض، می‌تواند از سمت کلاینت اورراید شود


class GenerateRequest(BaseModel):
    repo_path: str
    selected_modules: Dict[str, bool]  # e.g., {"root": true, "erd": false}
    model_name: str = MODEL_NAME # مدل اختیاری


@app.post("/generate-docs")
async def generate_docs(request: GenerateRequest):
    results = {}

    if not os.path.exists(request.repo_path):
        raise HTTPException(status_code=400, detail="مسیر پروژه یافت نشد.")

    # 1. تحلیل اولیه پروژه (یک بار برای همه ماژول‌ها)
    print(f"Analyzing repo: {request.repo_path}")
    try:
        analyzer = RepoAnalyzer(request.repo_path)
        analyzer.analyze()
    except Exception as e:
        print(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"خطا در تحلیل پروژه: {str(e)}")

    async with httpx.AsyncClient(timeout=300.0) as client:

        # 2. حلقه روی ماژول‌های درخواستی
        for module, is_selected in request.selected_modules.items():
            if not is_selected or module not in PROMPTS:
                continue

            print(f"Generating {module}...")

            # الف) دریافت کانتکست هوشمند مربوط به آن ماژول
            context = analyzer.get_context(module)
            prompt_text = PROMPTS[module]

            full_prompt = f"{prompt_text}\n\nCONTEXT:\n{context}"

            # ب) درخواست به Ollama
            try:
                response = await client.post(OLLAMA_URL, json={
                    "model": request.model_name or MODEL_NAME,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {
                        "num_ctx": 32768 # افزایش پنجره کانتکست
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

    return results


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
