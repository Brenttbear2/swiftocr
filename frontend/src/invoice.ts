// 發票的共用定義：佇列項目的型別、欄位的中文名稱與顯示方式
import type { InvoiceData, OcrResponse } from "./api";

/** 佇列中的一張發票：從放進來、辨識中，到辨識完成（或失敗） */
export type QueueItem = {
  id: string;
  file: File;
  previewUrl: string; // 縮圖用的暫時網址（只有圖片才有，PDF 是空字串）
  model: string; // 用哪個模型辨識
  status: "waiting" | "running" | "done" | "error";
  result: OcrResponse | null; // 辨識完成才有
  error: string; // 失敗時的原因
};

/** 需要人工確認的提醒有幾項（還沒辨識完就是 0） */
export function countWarnings(item: QueueItem): number {
  return item.result?.warnings.filter((w) => w.level === "warn").length ?? 0;
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

const TYPE_LABELS: Record<string, string> = {
  tw_triple: "三聯式統一發票",
  tw_triple_cashier: "收銀機統一發票（三聯）",
  tw_dual_cashier: "二聯式收銀機發票",
};

const TAX_TYPE_LABELS: Record<string, string> = {
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
