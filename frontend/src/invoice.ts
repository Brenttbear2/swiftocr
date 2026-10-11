// 發票的共用定義：佇列項目的型別、欄位的中文名稱與顯示方式、審核用的小工具
import type { InvoiceData, OcrResponse, RuleWarning } from "./api";

/** 佇列中的一張發票：從放進來、辨識中、辨識完成（或失敗），到人工確認 */
export type QueueItem = {
  id: string;
  file: File;
  previewUrl: string; // 縮圖用的暫時網址（只有圖片才有，PDF 是空字串）
  model: string; // 用哪個模型辨識
  status: "waiting" | "running" | "done" | "error";
  result: OcrResponse | null; // 辨識完成才有；保留 AI 原本的結果，不會被修改
  data: InvoiceData | null; // 目前的欄位值：一開始等於 AI 的結果，人工修改後跟著變
  warnings: RuleWarning[]; // 目前的提醒：人工修改後由後端重新檢查
  confirmed: boolean; // 使用者是否已按「確認」
  error: string; // 失敗時的原因
};

/** 需要人工確認的提醒有幾項（還沒辨識完就是 0） */
export function countWarnings(item: QueueItem): number {
  return item.warnings.filter((w) => w.level === "warn").length;
}

/** 這張發票要顯示的原圖：圖片用上傳的檔案，PDF 用後端轉好的第 1 頁（辨識完才有） */
export function imageUrl(item: QueueItem): string {
  return item.previewUrl || item.result?.meta.page_image || "";
}

/** 要顯示的欄位（幣別固定是 TWD，不顯示） */
export type FieldKey = Exclude<keyof InvoiceData, "currency">;

/** 欄位順序與中文名稱（和後端 rules.py 的 FIELD_LABELS 一致） */
export const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "type", label: "發票類型" },
  { key: "format", label: "稅額編碼" },
  { key: "invoice_number", label: "發票號碼" },
  { key: "date", label: "開立日期" },
  { key: "buyer_taxno", label: "買受人統編" },
  { key: "seller_taxno", label: "賣方統編" },
  { key: "tax_type", label: "課稅別" },
  { key: "sales", label: "銷售額" },
  { key: "tax", label: "稅額" },
  { key: "total", label: "總計" },
];

/** 用欄位名稱查中文名稱，例如 "buyer_taxno" → "買受人統編" */
export function fieldLabel(key: FieldKey): string {
  return FIELDS.find((f) => f.key === key)?.label ?? key;
}

/** 發票類型的中文名稱（審核時的下拉選單也用它） */
export const TYPE_LABELS: Record<string, string> = {
  tw_triple: "三聯式統一發票",
  tw_triple_cashier: "收銀機統一發票（三聯）",
  tw_dual_cashier: "二聯式收銀機發票",
};

/** 課稅別的中文名稱（審核時的下拉選單也用它） */
export const TAX_TYPE_LABELS: Record<string, string> = {
  "0": "應稅",
  "1": "零稅率",
  "2": "免稅",
};

const AMOUNT_KEYS: FieldKey[] = ["sales", "tax", "total"];

/** 把欄位的原始值轉成畫面上要顯示的文字 */
export function displayValue(key: FieldKey, value: InvoiceData[FieldKey]): string {
  if (value === null) return "—"; // 無法辨識
  if (key === "type") return TYPE_LABELS[String(value)] ?? String(value);
  if (key === "tax_type") return TAX_TYPE_LABELS[String(value)] ?? String(value);
  if (AMOUNT_KEYS.includes(key) && typeof value === "number") {
    return "NT$ " + value.toLocaleString("zh-TW"); // 1050 → "NT$ 1,050"
  }
  return String(value);
}

/** 這個欄位有沒有被人工改過（跟 AI 原本的結果比） */
export function isEdited(item: QueueItem, key: FieldKey): boolean {
  if (!item.result || !item.data) return false;
  return item.data[key] !== item.result.data[key];
}

/** 重新檢查後的提醒：後端這次的結果，再加上辨識時留下、仍然適用的提醒 */
export function mergeWarnings(item: QueueItem, data: InvoiceData, checked: RuleWarning[]): RuleWarning[] {
  const original = item.result?.warnings ?? [];
  const kept = original.filter((w) => {
    if (w.field === null) return true; // 整張發票的提醒（例如「PDF 只辨識第 1 頁」），重新檢查不會產生，要保留
    const key = w.field as FieldKey;
    // 「已自動修正」的說明：欄位沒被改過、這次也沒有新的提醒，就保留，讓人知道這格是系統算的
    return w.level === "fixed" && data[key] === item.result?.data[key] && !checked.some((c) => c.field === w.field);
  });
  return [...kept, ...checked];
}
