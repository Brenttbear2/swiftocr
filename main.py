import os
import json
import base64
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
from dotenv import load_dotenv
import fitz  # PyMuPDF — PDF 轉圖

load_dotenv()

app = FastAPI(title="發票 OCR API（OpenRouter）")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 可選模型清單（OpenRouter model ID），依廠商分組 ──
MODELS = [
    # OpenAI 系列
    {"id": "openai/gpt-4o",                  "label": "GPT-4o",                 "category": "openai", "note": "OpenAI 旗艦視覺模型"},
    {"id": "openai/gpt-4o-mini",             "label": "GPT-4o Mini",            "category": "openai", "note": "輕量低延遲 · 成本優化"},
    {"id": "openai/gpt-5-mini",              "label": "GPT-5 Mini",             "category": "openai", "note": "GPT-5 系列輕量版"},
    # Google 系列
    {"id": "google/gemini-3.1-pro-preview",  "label": "Gemini 3.1 Pro Preview", "category": "google", "note": "Google 最高品質旗艦"},
    {"id": "google/gemini-3.5-flash",        "label": "Gemini 3.5 Flash",       "category": "google", "note": "Google 高速推論"},
    {"id": "google/gemini-3.1-flash-lite",   "label": "Gemini 3.1 Flash Lite",  "category": "google", "note": "Google 最輕量 · 成本最低"},
]
DEFAULT_MODEL = "openai/gpt-4o"

INVOICE_PROMPT = """你是一個台灣統一發票 OCR 辨識系統。請仔細分析這張發票圖片，提取資訊並【只回傳 JSON，不要有任何說明文字或 markdown 標記】。

## 步驟一：判斷發票類型
- 三聯式統一發票（手寫或電腦打字，印有「統一發票（三聯式）」）→ type: "tw_triple", format: 21
- 收銀機統一發票（三聯副聯 / 扣抵聯，印表機列印，有詳細品項）→ type: "tw_triple_cashier", format: 25
- 二聯式長條型收銀機統一發票（熱感紙長條，通常只有總計金額）→ type: "tw_dual_cashier", format: 22

## 步驟二：提取欄位
- invoice_number：發票號碼，格式「2個大寫英文字母 + 8位數字」，例如 MY27951864
- date：開立日期，轉為 ISO 8601 (YYYY-MM-DD)。民國年 + 1911 = 西元年（民國112年6月30日 → 2023-06-30）
- buyer_taxno：買受人統一編號（8碼數字）
- seller_taxno：賣方統一編號（8碼數字，可能在印章中）
- tax_type：0（應稅）/ 1（零稅率）/ 2（免稅），通常為 0
- sales：銷售額（未稅金額），整數
- tax：稅額，整數
- total：總計（含稅），整數
- currency：固定 "TWD"

## 特別規則
- 二聯式（format 22）：票面只顯示含稅總額，請計算：
  sales = round(total / 1.05)，tax = total - sales
- 所有金額取整數（四捨五入）
- 無法辨識的欄位一律回傳 null
- seller_taxno 若被印章覆蓋，嘗試從印章文字中讀取
- 只回傳 JSON，不要有 ```json 標記或任何其他文字

## 回傳格式
{"type":"...","format":0,"invoice_number":"...","date":"YYYY-MM-DD","buyer_taxno":"...","seller_taxno":"...","tax_type":0,"sales":0,"tax":0,"total":0,"currency":"TWD"}"""


def pdf_to_base64_png(pdf_bytes: bytes) -> str:
    """PDF 第一頁轉為 PNG base64（2x 縮放提升辨識率）"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc[0]
    mat = fitz.Matrix(2.0, 2.0)
    pix = page.get_pixmap(matrix=mat)
    png_bytes = pix.tobytes("png")
    return base64.standard_b64encode(png_bytes).decode("utf-8")


@app.get("/api/models")
def get_models():
    """回傳可用模型清單（含分類與說明）"""
    return MODELS


@app.post("/api/ocr")
async def ocr_invoice(
    file: UploadFile = File(...),
    model: str = Form(default=DEFAULT_MODEL),
):
    content = await file.read()
    filename = (file.filename or "").lower()

    # ── 統一轉為 PNG base64 送入 Vision API ──
    if filename.endswith(".pdf"):
        try:
            b64 = pdf_to_base64_png(content)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"PDF 轉圖失敗：{e}")
        media_type = "image/png"
    elif filename.endswith(".png"):
        b64 = base64.standard_b64encode(content).decode("utf-8")
        media_type = "image/png"
    elif filename.endswith((".jpg", ".jpeg")):
        b64 = base64.standard_b64encode(content).decode("utf-8")
        media_type = "image/jpeg"
    else:
        raise HTTPException(status_code=400, detail="只支援 JPG、PNG、PDF 格式")

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="未設定 OPENROUTER_API_KEY 環境變數")

    # ── OpenRouter 呼叫（OpenAI 相容格式） ──
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        default_headers={
            "HTTP-Referer": "https://invoice-ocr-poc.local",
            "X-Title": "Invoice OCR POC",
        },
    )

    try:
        response = client.chat.completions.create(
            model=model,
            max_tokens=2048,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{b64}"
                            },
                        },
                        {
                            "type": "text",
                            "text": INVOICE_PROMPT,
                        },
                    ],
                }
            ],
        )

        result_text = response.choices[0].message.content.strip()

        # 清除可能的 markdown code block
        if "```" in result_text:
            for part in result_text.split("```"):
                part = part.strip().lstrip("json").strip()
                if part.startswith("{"):
                    result_text = part
                    break

        result = json.loads(result_text)
        result["_model"] = model          # 回傳使用的模型，供前端顯示
        return result

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=422,
            detail=f"辨識結果無法解析為 JSON，原始回傳：{result_text[:300]}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 掛載前端靜態檔案（放最後）
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
