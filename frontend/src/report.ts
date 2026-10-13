// 匯出與統計：從已確認的發票算出 AI 的欄位準確率，並產生 CSV／JSON 檔讓使用者下載
import type { InvoiceData, ModelInfo } from "./api";
import { displayValue, FIELDS, fieldLabel, isEdited, type FieldKey, type QueueItem } from "./invoice";

/** 這張發票被人工修正過哪些欄位（依欄位順序） */
export function editedKeys(item: QueueItem): FieldKey[] {
  return FIELDS.map((f) => f.key).filter((key) => isEdited(item, key));
}

// ── 統計 ──

/** 一群發票的統計數字（全部合計，或其中一個模型） */
export type Stats = {
  model: string; // 模型 id；全部合計時是空字串
  count: number; // 幾張
  editedFields: number; // 被人工修正的欄位數
  accuracy: number; // 欄位準確率，0～1
  avgSeconds: number; // 平均每張辨識幾秒
  costUsd: number; // 總成本（美元）
};

/** 統計面板與 JSON 要用的全部資料 */
export type Report = {
  total: Stats; // 全部合計
  byModel: Stats[]; // 每個模型各一筆
  fieldEdits: { key: FieldKey; count: number }[]; // 各欄位被修正幾次（次數多的在前，沒改過的不列）
};

// 算出一群發票的統計
function summarize(model: string, items: QueueItem[]): Stats {
  // reduce：從 0 開始，一張一張把數字加上去
  const editedFields = items.reduce((sum, it) => sum + editedKeys(it).length, 0);
  const totalMs = items.reduce((sum, it) => sum + (it.result?.meta.elapsed_ms ?? 0), 0);
  const costUsd = items.reduce((sum, it) => sum + (it.result?.meta.cost_usd ?? 0), 0);
  return {
    model,
    count: items.length,
    editedFields,
    accuracy: 1 - editedFields / (items.length * FIELDS.length), // 每張 10 個欄位
    avgSeconds: Math.round(totalMs / items.length / 100) / 10, // 3149 毫秒 → 3.1 秒
    costUsd: Math.round(costUsd * 1e6) / 1e6, // 小數加總會有誤差（0.1+0.2=0.30000000000000004），取到 6 位
  };
}

/** 只算「已確認」的發票（人看過才知道 AI 對不對）；還沒有確認的就回傳 null */
export function buildReport(items: QueueItem[]): Report | null {
  const confirmed = items.filter((it) => it.confirmed);
  if (confirmed.length === 0) return null;

  // 用到哪些模型：Set 會自動去掉重複的，再用 [...] 轉回陣列
  const models = [...new Set(confirmed.map((it) => it.model))];
  const fieldEdits = FIELDS.map((f) => ({
    key: f.key,
    count: confirmed.filter((it) => isEdited(it, f.key)).length,
  }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count); // 次數多的排前面

  return {
    total: summarize("", confirmed),
    byModel: models.map((model) => summarize(model, confirmed.filter((it) => it.model === model))),
    fieldEdits,
  };
}

// ── 匯出 ──

export type ExportFormat = "csv" | "json";

// 發票欄位（含幣別）：CSV 的欄位順序，標題沿用 JSON 的英文名稱，方便其他系統匯入
const DATA_KEYS: (keyof InvoiceData)[] = [...FIELDS.map((f) => f.key), "currency"];

// 模型 id → 顯示名稱
function modelName(models: ModelInfo[], id: string): string {
  return models.find((m) => m.id === id)?.label ?? id;
}

// 修正明細，例如「賣方統編：12345678 → 12345675；總計：NT$ 200 → NT$ 210」
function editDetail(item: QueueItem): string {
  return editedKeys(item)
    .map((key) => {
      const before = displayValue(key, item.result?.data[key] ?? null);
      const after = displayValue(key, item.data?.[key] ?? null);
      return `${fieldLabel(key)}：${before} → ${after}`;
    })
    .join("；");
}

// CSV 的一格：文字開頭是 = + - @ 的先加 '，免得 Excel 當成公式執行（CSV 注入）；有逗號、引號或換行的用引號包起來，裡面的引號寫成兩個
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? "'" + value : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// 統編那一格：Excel 會把開頭的 0 吃掉（01234567 → 1234567），寫成 ="01234567" 讓 Excel 當成文字
function taxnoCell(value: unknown): string {
  return typeof value === "string" && /^\d+$/.test(value) ? `="${value}"` : csvCell(value);
}

/** 產生 CSV：一張發票一列，最後兩欄是修正紀錄 */
export function buildCsv(items: QueueItem[], models: ModelInfo[]): string {
  const header = ["檔名", ...DATA_KEYS, "模型", "秒數", "成本(USD)", "修正欄位", "修正明細"];
  const rows = items.map((item) => {
    const meta = item.result?.meta;
    const cells = [
      csvCell(item.file.name),
      ...DATA_KEYS.map((key) => (key.endsWith("_taxno") ? taxnoCell(item.data?.[key]) : csvCell(item.data?.[key]))),
      csvCell(modelName(models, item.model)),
      csvCell(meta ? (meta.elapsed_ms / 1000).toFixed(1) : null),
      csvCell(meta?.cost_usd),
      csvCell(editedKeys(item).map(fieldLabel).join("、")),
      csvCell(editDetail(item)),
    ];
    return cells.join(",");
  });
  // 開頭的 \uFEFF（BOM）告訴 Excel 這是 UTF-8，中文才不會變亂碼；換行用 Excel 習慣的 \r\n
  return "\uFEFF" + [header.join(","), ...rows].join("\r\n");
}

/** 產生 JSON：每張發票附上 AI 原值與修正了哪些欄位，最前面是統計 */
export function buildJson(items: QueueItem[], models: ModelInfo[]): string {
  const report = {
    exported_at: new Date().toISOString(),
    summary: buildReport(items),
    invoices: items.map((item) => ({
      file: item.file.name,
      model: modelName(models, item.model),
      data: item.data, // 人工確認後的值
      ai_data: item.result?.data ?? null, // AI 原本的值
      edited_fields: editedKeys(item),
      warnings: item.warnings,
      elapsed_ms: item.result?.meta.elapsed_ms ?? null,
      cost_usd: item.result?.meta.cost_usd ?? null,
    })),
  };
  return JSON.stringify(report, null, 2); // null, 2：縮排 2 格，人也讀得懂
}

// 檔名用的時間，例如 20261011_1530
function timestamp(): string {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0"); // 5 → "05"
  return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}_${two(d.getHours())}${two(d.getMinutes())}`;
}

/** 把已確認的發票存成檔案，讓瀏覽器下載 */
export function downloadReport(items: QueueItem[], models: ModelInfo[], format: ExportFormat) {
  const confirmed = items.filter((it) => it.confirmed);
  const content = format === "csv" ? buildCsv(confirmed, models) : buildJson(confirmed, models);
  const type = format === "csv" ? "text/csv;charset=utf-8" : "application/json";

  // 文字 → Blob（瀏覽器記憶體裡的檔案）→ 暫時網址 → 用一個看不見的連結「點」下去就會下載
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `發票辨識結果_${timestamp()}.${format}`; // download：點了是下載，不是打開
  link.click();
  URL.revokeObjectURL(url); // 用完就把暫時網址還給瀏覽器
}
