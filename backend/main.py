"""程式入口：建立網站、定義 3 個 API、掛上前端網頁。

一個辨識請求的路線：
    POST /api/ocr → ai.py 轉檔並呼叫 AI → rules.py 驗算業務規則 → 回傳結果

啟動方式（在專案根目錄）：
    .venv\\Scripts\\python.exe -m uvicorn main:app --app-dir backend --reload
"""

import time

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import config
from ai import OcrError, recognize_invoice
from rules import apply_rules
from schemas import HealthStatus, ModelInfo, OcrMeta, OcrResponse, RuleWarning

app = FastAPI(
    title="發票 OCR 辨識 API",
    version="2.0.0",
    description="上傳台灣統一發票圖片或 PDF，由 Vision LLM 辨識為結構化資料，並以業務規則驗算。",
)


# ════════════════════════ API 1：服務狀態檢查 ════════════════════════

@app.get("/api/health", response_model=HealthStatus, summary="服務狀態檢查", tags=["系統"])
def health() -> HealthStatus:
    """雲端平台會定期呼叫這個網址，確認服務還活著。"""
    return HealthStatus(status="ok", api_key_configured=bool(config.OPENROUTER_API_KEY))


# ════════════════════════ API 2：模型清單 ════════════════════════

@app.get("/api/models", response_model=list[ModelInfo], summary="可選的辨識模型清單", tags=["模型"])
def list_models() -> list[dict]:
    return config.MODELS


# ════════════════════════ API 3：辨識發票 ════════════════════════

@app.post("/api/ocr", response_model=OcrResponse, summary="辨識一張發票", tags=["發票辨識"])
async def ocr_invoice(
    file: UploadFile = File(..., description="發票圖片（JPG / PNG）或 PDF（只辨識第 1 頁）"),
    model: str = Form(config.DEFAULT_MODEL, description="模型 ID，必須在 /api/models 的清單內"),
) -> OcrResponse:
    started = time.perf_counter()

    # 1. 檢查模型是否在白名單內
    if model not in config.ALLOWED_MODEL_IDS:
        raise HTTPException(status_code=400, detail=f"不支援的模型：{model}")

    # 2. 讀取檔案並檢查大小
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="上傳的檔案是空的")
    if len(content) > config.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"檔案超過 {config.MAX_UPLOAD_MB}MB 上限")

    # 3. 轉檔並呼叫 AI 辨識（ai.py）
    try:
        result = await recognize_invoice(content, model)
    except OcrError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e

    # 4. 用程式驗算業務規則（rules.py）
    data, warnings = apply_rules(result.raw)
    if result.page_count > 1:
        warnings.insert(0, RuleWarning(level="warn", message=f"PDF 共 {result.page_count} 頁，只辨識了第 1 頁"))

    # 5. 組裝回應
    return OcrResponse(
        data=data,
        warnings=warnings,
        meta=OcrMeta(
            model=model,
            elapsed_ms=round((time.perf_counter() - started) * 1000),
            source_kind=result.source_kind,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            cost_usd=result.cost_usd,
        ),
    )


# ════════════════════════ 把 FastAPI 預設的英文格式錯誤改成中文 ════════════════════════

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    problems = []
    for error in exc.errors():
        field = error["loc"][-1]
        if error["type"] == "missing":
            problems.append(f"缺少必要欄位 {field}")
        else:
            problems.append(f"欄位 {field} 格式不正確")
    return JSONResponse(status_code=422, content={"detail": "；".join(problems)})


# ════════════════════════ 前端網頁 ════════════════════════
# 必須放在最後：mount("/") 會接住所有網址，放前面的話上面的 API 會收不到請求
if config.FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")
