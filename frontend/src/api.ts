// 呼叫後端 API 的函式，以及後端回傳資料的型別（一一對應 backend/schemas.py）

/** GET /api/health 的回應（對應 schemas.py 的 HealthStatus） */
export type HealthStatus = {
  status: "ok";
  api_key_configured: boolean;
};

/** 單一模型資訊（對應 schemas.py 的 ModelInfo） */
export type ModelInfo = {
  id: string;
  label: string;
  category: "openai" | "google";
  note: string;
};

/** 本案支援的三種發票類型（對應 schemas.py 的 InvoiceType） */
export type InvoiceType = "tw_triple" | "tw_triple_cashier" | "tw_dual_cashier";

/** 辨識出的發票欄位，無法辨識的是 null（對應 schemas.py 的 InvoiceData） */
export type InvoiceData = {
  type: InvoiceType | null;
  format: number | null;
  invoice_number: string | null;
  date: string | null;
  buyer_taxno: string | null;
  seller_taxno: string | null;
  tax_type: number | null;
  sales: number | null;
  tax: number | null;
  total: number | null;
  currency: string;
};

/** 規則檢查的提醒：fixed = 已自動修正、warn = 需要人工確認（對應 schemas.py 的 RuleWarning） */
export type RuleWarning = {
  field: string | null; // 整張發票層級的提醒是 null
  level: "fixed" | "warn";
  message: string;
};

/** 這次辨識的附帶資訊（對應 schemas.py 的 OcrMeta） */
export type OcrMeta = {
  model: string;
  elapsed_ms: number;
  source_kind: "pdf" | "png" | "jpeg";
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
};

/** POST /api/ocr 的回應（對應 schemas.py 的 OcrResponse） */
export type OcrResponse = {
  data: InvoiceData;
  warnings: RuleWarning[];
  meta: OcrMeta;
};

/** 向後端發請求，回傳解析好的 JSON；失敗時丟出帶中文訊息的錯誤 */
async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error("連不上後端，請確認後端已啟動");
  }
  const body = await res.json().catch(() => null); // 回應不是 JSON 時當作 null
  if (!res.ok) {
    throw new Error(body?.detail ?? `後端回應錯誤（${res.status}），請確認後端已啟動`);
  }
  return body as T;
}

export function getHealth(): Promise<HealthStatus> {
  return requestJson<HealthStatus>("/api/health");
}

export function getModels(): Promise<ModelInfo[]> {
  return requestJson<ModelInfo[]>("/api/models");
}

/** 上傳一張發票請後端辨識（POST /api/ocr） */
export function recognizeInvoice(file: File, model: string): Promise<OcrResponse> {
  // 用「表單」格式送出，欄位名稱 file、model 必須和 main.py 的參數名稱一樣
  const form = new FormData();
  form.append("file", file);
  form.append("model", model);
  return requestJson<OcrResponse>("/api/ocr", { method: "POST", body: form });
}
