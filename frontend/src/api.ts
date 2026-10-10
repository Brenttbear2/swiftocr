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

/** 向後端發 GET 請求，回傳解析好的 JSON；失敗時丟出帶中文訊息的錯誤 */
async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
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
  return getJson<HealthStatus>("/api/health");
}

export function getModels(): Promise<ModelInfo[]> {
  return getJson<ModelInfo[]>("/api/models");
}
