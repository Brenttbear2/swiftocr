"""資料格式定義：API 收到與回傳的資料「長什麼樣子」。

FastAPI 會依照這些定義自動檢查資料型別，並產生 /docs 的 API 說明文件。
"""

from typing import Literal

from pydantic import BaseModel, Field

# 本案支援的三種發票類型
InvoiceType = Literal["tw_triple", "tw_triple_cashier", "tw_dual_cashier"]

# 業務規則：type → format 對照（不可隨意更動）
TYPE_TO_FORMAT: dict[str, int] = {
    "tw_triple": 21,          # 三聯式統一發票
    "tw_triple_cashier": 25,  # 收銀機統一發票（三聯副聯）
    "tw_dual_cashier": 22,    # 二聯式長條型收銀機發票
}


class InvoiceData(BaseModel):
    """辨識出的發票欄位。無法辨識的欄位一律為 null。"""

    type: InvoiceType | None = Field(None, description="發票類型")
    format: int | None = Field(None, description="稅額編碼：21 / 25 / 22")
    invoice_number: str | None = Field(None, description="發票號碼，2 個大寫英文字母 + 8 位數字", examples=["MY27951864"])
    date: str | None = Field(None, description="開立日期（西元 YYYY-MM-DD）", examples=["2023-06-30"])
    buyer_taxno: str | None = Field(None, description="買受人統一編號（8 碼）")
    seller_taxno: str | None = Field(None, description="賣方統一編號（8 碼）")
    tax_type: int | None = Field(None, description="課稅別：0 應稅 / 1 零稅率 / 2 免稅")
    sales: int | None = Field(None, description="銷售額（未稅）")
    tax: int | None = Field(None, description="稅額")
    total: int | None = Field(None, description="總計（含稅）")
    currency: str = Field("TWD", description="幣別，固定為 TWD")


class RuleWarning(BaseModel):
    """規則檢查的結果。

    level = "fixed"：系統已自動修正（結果可確定），提醒使用者知道
    level = "warn" ：系統無法確定，需要人工確認
    """

    field: str | None = Field(None, description="相關的欄位名稱；整張發票層級的提醒為 null")
    level: Literal["fixed", "warn"]
    message: str


class OcrMeta(BaseModel):
    """這次辨識的附帶資訊。"""

    model: str = Field(description="使用的模型 ID")
    elapsed_ms: int = Field(description="後端處理總耗時（毫秒）")
    source_kind: Literal["pdf", "png", "jpeg"] = Field(description="上傳檔案的實際格式")
    prompt_tokens: int | None = Field(None, description="送給 AI 的 token 數（含圖片）")
    completion_tokens: int | None = Field(None, description="AI 回答的 token 數")
    cost_usd: float | None = Field(None, description="這次呼叫的費用（美元），由 OpenRouter 提供")


class OcrResponse(BaseModel):
    """POST /api/ocr 的回應。"""

    data: InvoiceData
    warnings: list[RuleWarning]
    meta: OcrMeta


class ModelInfo(BaseModel):
    """GET /api/models 回傳的單一模型資訊。"""

    id: str
    label: str
    category: Literal["openai", "google"]
    note: str


class HealthStatus(BaseModel):
    """GET /api/health 的回應。"""

    status: Literal["ok"]
    api_key_configured: bool
