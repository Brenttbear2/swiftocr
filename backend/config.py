"""系統設定：所有可調整的數值與環境變數集中在這裡。"""

import os
from pathlib import Path

from dotenv import load_dotenv

# ── 路徑 ──
# __file__ 是這個檔案自己的路徑：backend/config.py
# .parents[0] = backend、.parents[1] = 專案根目錄
PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = PROJECT_ROOT / "frontend"

# 讀取專案根目錄的 .env，把裡面的設定放進環境變數
load_dotenv(PROJECT_ROOT / ".env")

# ── OpenRouter ──
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")  # 沒設定時為 None
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_HEADERS = {
    "HTTP-Referer": "https://invoice-ocr-poc.local",
    "X-Title": "Invoice OCR",
}

# ── 可選模型清單（OpenRouter model ID），依廠商分組 ──
MODELS = [
    # OpenAI 系列
    {"id": "openai/gpt-4o",                 "label": "GPT-4o",                 "category": "openai", "note": "OpenAI 旗艦視覺模型"},
    {"id": "openai/gpt-4o-mini",            "label": "GPT-4o Mini",            "category": "openai", "note": "輕量低延遲 · 成本優化"},
    {"id": "openai/gpt-5-mini",             "label": "GPT-5 Mini",             "category": "openai", "note": "GPT-5 系列輕量版"},
    # Google 系列
    {"id": "google/gemini-3.1-pro-preview", "label": "Gemini 3.1 Pro Preview", "category": "google", "note": "Google 最高品質旗艦"},
    {"id": "google/gemini-3.5-flash",       "label": "Gemini 3.5 Flash",       "category": "google", "note": "Google 高速推論"},
    {"id": "google/gemini-3.1-flash-lite",  "label": "Gemini 3.1 Flash Lite",  "category": "google", "note": "Google 最輕量 · 成本最低"},
]
DEFAULT_MODEL = "openai/gpt-4o"

# 模型白名單：只接受清單內的模型，避免被指定昂貴或不相關的模型
ALLOWED_MODEL_IDS = {m["id"] for m in MODELS}

# ── 呼叫 AI 的限制 ──
LLM_MAX_TOKENS = 4096        # 回答長度上限（推理型模型會先用掉一部分在「思考」上，所以給寬一點）
LLM_TIMEOUT_SECONDS = 90     # 等待 AI 回應的最長秒數
LLM_MAX_RETRIES = 1          # 連線失敗時自動重試的次數

# ── 上傳檔案的限制 ──
MAX_UPLOAD_MB = 10
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
PDF_RENDER_SCALE = 2.0       # PDF 轉圖時放大倍數，數字越大小字越清楚，但檔案也越大
