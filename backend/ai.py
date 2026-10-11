"""AI 辨識：把上傳的檔案轉成圖片，交給 AI 辨識，取回 JSON。

這個檔案分成兩段：
    第 1 段　檔案轉換：判斷格式、PDF 轉圖、編碼成 base64
    第 2 段　呼叫 AI：把圖片和指示送到 OpenRouter，解析回答
最下方的 recognize_invoice() 把兩段串起來，是給 main.py 呼叫的入口。
"""

import asyncio
import base64
import json
from dataclasses import dataclass

import openai
import pymupdf  # PyMuPDF：處理 PDF 的套件（舊名 fitz）
from openai import AsyncOpenAI

import config
from prompt import INVOICE_PROMPT


class OcrError(Exception):
    """辨識過程中可預期的失敗（檔案不對、AI 出錯……）。

    message 是給使用者看的中文說明，status_code 是要回給前端的 HTTP 狀態碼。
    """

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class AIResult:
    """辨識結果與相關資訊。"""

    raw: dict                       # AI 回傳的 JSON（尚未經過規則檢查）
    source_kind: str                # 上傳檔案的實際格式："pdf" / "png" / "jpeg"
    page_count: int                 # PDF 的總頁數（圖片固定為 1）
    page_image: str | None          # PDF 轉成的第 1 頁圖片（data URL），讓前端審核時顯示；圖片檔是 None
    prompt_tokens: int | None
    completion_tokens: int | None
    cost_usd: float | None


# ════════════════════════ 第 1 段：檔案轉換 ════════════════════════

def detect_kind(content: bytes) -> str | None:
    """看檔案開頭的幾個位元組（檔案簽章）判斷真正的格式，不相信副檔名。"""
    if content.startswith(b"%PDF"):
        return "pdf"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if content.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    return None


def to_data_url(content: bytes, mime_type: str) -> str:
    """把檔案內容編碼成 base64 文字，組成 data URL。"""
    b64 = base64.b64encode(content).decode("ascii")
    return f"data:{mime_type};base64,{b64}"


def pdf_first_page_to_png(content: bytes) -> tuple[bytes, int]:
    """把 PDF 第一頁轉成 PNG 圖片，回傳（PNG 內容, PDF 總頁數）。"""
    try:
        with pymupdf.open(stream=content, filetype="pdf") as doc:
            if doc.page_count == 0:
                raise OcrError("PDF 沒有任何頁面", 400)
            matrix = pymupdf.Matrix(config.PDF_RENDER_SCALE, config.PDF_RENDER_SCALE)
            pixmap = doc[0].get_pixmap(matrix=matrix)
            return pixmap.tobytes("png"), doc.page_count
    except OcrError:
        raise
    except Exception as e:
        raise OcrError(f"PDF 無法開啟，檔案可能已損毀（{e}）", 400) from e


def file_to_image(content: bytes) -> tuple[str, str, int]:
    """把上傳的檔案轉成 AI 看得懂的圖片，回傳（data URL, 原始格式, 頁數）。"""
    kind = detect_kind(content)

    if kind == "pdf":
        png_bytes, page_count = pdf_first_page_to_png(content)
        return to_data_url(png_bytes, "image/png"), "pdf", page_count
    if kind == "png":
        return to_data_url(content, "image/png"), "png", 1
    if kind == "jpeg":
        return to_data_url(content, "image/jpeg"), "jpeg", 1

    raise OcrError("只支援 JPG、PNG、PDF 格式", 400)


# ════════════════════════ 第 2 段：呼叫 AI ════════════════════════

# 整個程式共用同一個連線用戶端，不必每次請求都重建
_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    """取得連線用戶端；第一次呼叫時才建立。"""
    global _client
    if not config.OPENROUTER_API_KEY:
        raise OcrError("尚未設定 OPENROUTER_API_KEY，請在專案根目錄的 .env 檔設定", 500)
    if _client is None:
        _client = AsyncOpenAI(
            base_url=config.OPENROUTER_BASE_URL,
            api_key=config.OPENROUTER_API_KEY,
            default_headers=config.OPENROUTER_HEADERS,
            timeout=config.LLM_TIMEOUT_SECONDS,
            max_retries=config.LLM_MAX_RETRIES,
        )
    return _client


def extract_json(text: str) -> dict:
    """從 AI 的回答中取出 JSON 物件。

    即使要求只回傳 JSON，有些模型仍會加上 ```json 標記或前後說明文字，
    所以取第一個「{」到最後一個「}」之間的內容來解析。
    """
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("找不到 JSON 物件")
    result = json.loads(text[start : end + 1])
    if not isinstance(result, dict):
        raise ValueError("JSON 不是物件格式")
    return result


async def ask_ai(image_data_url: str, model: str):
    """把發票圖片和指示送給指定模型，回傳（AI 的 JSON, 用量資訊）。"""
    client = get_client()

    try:
        response = await client.chat.completions.create(
            model=model,
            max_tokens=config.LLM_MAX_TOKENS,
            response_format={"type": "json_object"},       # 要求模型只輸出 JSON
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                        {"type": "text", "text": INVOICE_PROMPT},
                    ],
                }
            ],
            extra_body={"usage": {"include": True}},         # 請 OpenRouter 附上這次的費用
        )
    # 注意順序：較特定的錯誤要寫在前面，否則會被較籠統的錯誤先接走
    except openai.APITimeoutError as e:
        raise OcrError(f"AI 超過 {config.LLM_TIMEOUT_SECONDS} 秒沒有回應，請稍後再試或換一個模型", 504) from e
    except openai.AuthenticationError as e:
        raise OcrError("OpenRouter API key 無效或已被撤銷，請檢查 .env 設定") from e
    except openai.RateLimitError as e:
        raise OcrError("請求太頻繁，請稍等一下再試", 503) from e
    except openai.APIStatusError as e:
        if e.status_code == 402:
            raise OcrError("OpenRouter 帳戶額度不足，請先儲值") from e
        raise OcrError(f"AI 服務回傳錯誤（{e.status_code}）：{e.message}") from e
    except openai.APIConnectionError as e:
        raise OcrError("無法連線到 OpenRouter，請檢查網路連線") from e

    choice = response.choices[0] if response.choices else None
    content = choice.message.content if choice else None
    if not content:
        if choice and choice.finish_reason == "length":
            raise OcrError("AI 的回答超過長度上限，請換一個模型再試")
        raise OcrError("AI 沒有回傳任何內容，請再試一次或換一個模型")

    try:
        raw = extract_json(content)
    except ValueError as e:
        raise OcrError(f"AI 回傳的內容不是有效的 JSON：{content[:200]}") from e

    return raw, response.usage


# ════════════════════════ 入口：把兩段串起來 ════════════════════════

async def recognize_invoice(content: bytes, model: str) -> AIResult:
    """檔案 → 圖片 → AI → JSON。失敗時拋出 OcrError。"""
    # PDF 轉圖比較耗 CPU，交給背景執行緒處理，不卡住其他請求
    data_url, source_kind, page_count = await asyncio.to_thread(file_to_image, content)

    raw, usage = await ask_ai(data_url, model)

    return AIResult(
        raw=raw,
        source_kind=source_kind,
        page_count=page_count,
        page_image=data_url if source_kind == "pdf" else None,   # 圖片檔前端本來就有，不用再傳回去
        prompt_tokens=usage.prompt_tokens if usage else None,
        completion_tokens=usage.completion_tokens if usage else None,
        cost_usd=getattr(usage, "cost", None),   # OpenRouter 額外提供的欄位，不一定存在
    )
