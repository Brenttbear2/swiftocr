// 一張發票的辨識結果卡片：依意義分組顯示欄位（號碼日期、統編、金額），並標出提醒
import type { InvoiceData, RuleWarning } from "./api";
import { countWarnings, displayValue, fieldLabel, type FieldKey, type QueueItem } from "./invoice";

type Props = {
  item: QueueItem;
  modelLabel: string; // 模型的顯示名稱
  onRetry: () => void;
};

export default function ResultCard({ item, modelLabel, onRetry }: Props) {
  const result = item.result;
  const warnings = result?.warnings ?? [];
  const warnCount = countWarnings(item); // 需要人工確認的數量
  const generalWarnings = warnings.filter((w) => w.field === null); // 整張發票層級的提醒

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* 標題列：發票類型（完成後才知道）、檔名、模型、狀態 */}
      <div className="flex items-start gap-3 px-5 pt-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {result ? displayValue("type", result.data.type) : item.file.name}
            {result?.data.format != null && (
              <span className="ml-2 font-mono text-xs font-normal text-slate-400">稅額編碼 {result.data.format}</span>
            )}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {result && <>{item.file.name} · </>}
            {modelLabel} · {Math.ceil(item.file.size / 1024)} KB
          </p>
        </div>
        <StatusBadge item={item} warnCount={warnCount} />
      </div>

      {/* 辨識中：顯示佔位的灰色線條 */}
      {(item.status === "running" || item.status === "waiting") && (
        <div className="space-y-2 px-5 pt-4 pb-5">
          <div className={"h-3 w-2/5 rounded bg-slate-100 " + (item.status === "running" ? "animate-pulse" : "")} />
          <div className={"h-3 w-3/5 rounded bg-slate-100 " + (item.status === "running" ? "animate-pulse" : "")} />
        </div>
      )}

      {/* 失敗：顯示原因與重試按鈕 */}
      {item.status === "error" && (
        <div className="m-5 mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">{item.error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-white px-3 py-1.5 font-medium text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-100"
          >
            用目前選的模型重試
          </button>
        </div>
      )}

      {/* 完成：整張的提醒 → 欄位（左：號碼日期統編，右：金額） → 耗時費用 */}
      {result && (
        <>
          {generalWarnings.map((w) => (
            <p key={w.message} className="mx-5 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              ⚠ {w.message}
            </p>
          ))}

          <div className="grid gap-x-6 gap-y-1 px-5 pt-3 pb-4 md:grid-cols-[1fr_15rem]">
            {/* 左：發票本身與交易對象 */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              <Field name="invoice_number" data={result.data} warnings={warnings} />
              <Field name="date" data={result.data} warnings={warnings} />
              <Field name="buyer_taxno" data={result.data} warnings={warnings} />
              <Field name="seller_taxno" data={result.data} warnings={warnings} />
              <Field name="tax_type" data={result.data} warnings={warnings} plain />
            </dl>

            {/* 右：金額，像收據底部一樣靠右對齊 */}
            <dl className="self-start rounded-xl bg-slate-50 px-4 py-2">
              <Field name="sales" data={result.data} warnings={warnings} amount />
              <Field name="tax" data={result.data} warnings={warnings} amount />
              <div className="my-1 border-t border-dashed border-slate-300" />
              <Field name="total" data={result.data} warnings={warnings} amount strong />
            </dl>
          </div>

          <p className="border-t border-slate-100 px-5 py-2.5 font-mono text-[11px] text-slate-400">
            耗時 {(result.meta.elapsed_ms / 1000).toFixed(1)} 秒
            {result.meta.cost_usd !== null && ` · US$ ${result.meta.cost_usd.toFixed(4)}`}
          </p>
        </>
      )}
    </article>
  );
}

// 一個欄位：名稱、值、這個欄位的提醒（warn 標黃、fixed 附說明）
type FieldProps = {
  name: FieldKey; // 要顯示哪個欄位
  data: InvoiceData;
  warnings: RuleWarning[];
  plain?: boolean; // 值不用等寬字（例如「應稅」這種文字）
  amount?: boolean; // 金額：名稱在左、值靠右
  strong?: boolean; // 加粗（總計）
};

function Field({ name, data, warnings, plain, amount, strong }: FieldProps) {
  const value = data[name];
  const mine = warnings.filter((w) => w.field === name); // 屬於這個欄位的提醒
  const needsCheck = mine.some((w) => w.level === "warn");

  return (
    <div className={"-mx-2 rounded-lg px-2 py-1.5 " + (needsCheck ? "bg-amber-50 ring-1 ring-amber-200" : "")}>
      <div className={amount ? "flex items-baseline justify-between gap-3" : ""}>
        <dt className="text-xs text-slate-500">{fieldLabel(name)}</dt>
        <dd
          className={
            (plain ? "" : "font-mono tabular-nums ") +
            (strong ? "text-lg font-semibold " : "font-medium ") +
            (value === null ? "text-slate-300" : "text-slate-900") +
            (amount ? "" : " mt-0.5")
          }
        >
          {name === "invoice_number" && value !== null ? <InvoiceNumber value={String(value)} /> : displayValue(name, value)}
        </dd>
      </div>
      {mine.map((w) => (
        <p key={w.message} className={"mt-0.5 text-xs " + (w.level === "warn" ? "text-amber-700" : "text-brand")}>
          {w.level === "warn" ? "⚠ " : "✓ 已自動修正："}
          {w.message}
        </p>
      ))}
    </div>
  );
}

// 發票號碼拆成「字軌（2 個英文字母）＋ 8 碼數字」，格式不符就原樣顯示
export function InvoiceNumber({ value }: { value: string }) {
  const match = /^([A-Z]{2})(\d{8})$/.exec(value);
  if (!match) return <>{value}</>;
  return (
    <>
      <span className="mr-1 rounded bg-slate-900 px-1 py-px text-[0.8em] text-white">{match[1]}</span>
      {match[2]}
    </>
  );
}

// 右上角的狀態標籤：等待中 / 辨識中 / 完成 / 需確認 / 失敗
export function StatusBadge({ item, warnCount }: { item: QueueItem; warnCount: number }) {
  const base = "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";

  if (item.status === "waiting") {
    return <span className={base + " bg-slate-100 text-slate-500"}>等待中</span>;
  }
  if (item.status === "running") {
    return (
      <span className={base + " bg-brand-soft text-brand"}>
        {/* 轉圈圈：animate-spin 讓它一直旋轉 */}
        <svg viewBox="0 0 24 24" fill="none" className="size-3.5 animate-spin">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        辨識中…
      </span>
    );
  }
  if (item.status === "error") {
    return <span className={base + " bg-red-50 text-red-700"}>失敗</span>;
  }
  if (warnCount > 0) {
    return <span className={base + " bg-amber-50 text-amber-800"}>需確認 {warnCount} 項</span>;
  }
  return <span className={base + " bg-emerald-50 text-emerald-700"}>完成</span>;
}
