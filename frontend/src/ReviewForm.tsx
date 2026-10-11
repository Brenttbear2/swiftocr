// 審核表單：一張發票的欄位（可以修改）、提醒、AI 原值，以及「確認」按鈕
import type { InvoiceData } from "./api";
import {
  displayValue,
  fieldLabel,
  isEdited,
  TAX_TYPE_LABELS,
  TYPE_LABELS,
  type FieldKey,
  type QueueItem,
} from "./invoice";

type Props = {
  item: QueueItem;
  modelLabel: string; // 模型的顯示名稱
  onEdit: (key: FieldKey, value: InvoiceData[FieldKey]) => void; // 改了一個欄位
  onRecheck: (data: InvoiceData) => void; // 改完了，請後端重新檢查
  onConfirm: () => void; // 按「確認，下一張」
  onUnconfirm: () => void; // 按「取消確認」
  onRetry: () => void; // 失敗時按「重試」
};

export default function ReviewForm({ item, modelLabel, onEdit, onRecheck, onConfirm, onUnconfirm, onRetry }: Props) {
  const data = item.data;
  const generalWarnings = item.warnings.filter((w) => w.field === null); // 整張發票層級的提醒
  const isDual = data?.type === "tw_dual_cashier";

  // 改一個欄位並立刻重新檢查（下拉選單、「還原」按鈕用：選了就算改完）
  function editAndCheck(key: FieldKey, value: InvoiceData[FieldKey]) {
    if (!data) return;
    onEdit(key, value);
    onRecheck({ ...data, [key]: value });
  }

  // 每個欄位都要用到的東西，打包成一包，下面 <Field {...shared} /> 一次交出去
  const shared = { item, onEdit, onCommit: () => data && onRecheck(data), onRestore: editAndCheck };

  return (
    <div className="flex flex-col bg-white lg:h-full">
      <div className="px-6 pt-5 pb-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {/* 標題：發票類型（可以改）＋稅額編碼（跟著類型自動決定） */}
        <div className="flex items-end gap-3">
          {data ? (
            <label className="min-w-0 flex-1">
              <span className="text-xs text-slate-500">發票類型</span>
              <select
                value={data.type ?? ""}
                onChange={(e) => editAndCheck("type", (e.target.value || null) as InvoiceData["type"])}
                className={
                  "mt-1 block w-full rounded-lg border bg-white px-2.5 py-2 text-lg font-semibold outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 " +
                  (hasWarn(item, "type") ? "border-amber-300 bg-amber-50" : "border-slate-200")
                }
              >
                <option value="">（無法判斷）</option>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldNotes name="type" item={item} onRestore={editAndCheck} />
            </label>
          ) : (
            <p className="min-w-0 flex-1 truncate text-lg font-semibold">{item.file.name}</p>
          )}
          {data && (
            <p className="pb-2.5 font-mono text-xs text-slate-400">
              稅額編碼 <span className="text-slate-700">{data.format ?? "—"}</span>
            </p>
          )}
        </div>
        <p className="mt-2 truncate text-xs text-slate-400">
          {item.file.name} · {modelLabel} · {Math.ceil(item.file.size / 1024)} KB
        </p>

        {/* 還沒辨識完 */}
        {(item.status === "waiting" || item.status === "running") && (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-slate-500">{item.status === "running" ? "辨識中，請稍候…" : "排隊等待辨識中…"}</p>
            <div className="h-9 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-9 w-2/3 animate-pulse rounded-lg bg-slate-100" />
          </div>
        )}

        {/* 失敗 */}
        {item.status === "error" && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
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

        {data && (
          <>
            {generalWarnings.map((w) => (
              <p key={w.message} className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                ⚠ {w.message}
              </p>
            ))}

            {/* 發票本身與交易對象 */}
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
              <Field name="invoice_number" {...shared} />
              <Field name="date" placeholder="YYYY-MM-DD" {...shared} />
              <Field name="buyer_taxno" {...shared} />
              <Field name="seller_taxno" {...shared} />
              <label className="col-span-2 sm:col-span-1">
                <span className="text-xs text-slate-500">課稅別</span>
                <select
                  value={data.tax_type ?? ""}
                  onChange={(e) => editAndCheck("tax_type", e.target.value === "" ? null : Number(e.target.value))}
                  className={
                    "mt-1 block w-full rounded-lg border bg-white px-2.5 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 " +
                    (hasWarn(item, "tax_type") ? "border-amber-300 bg-amber-50" : "border-slate-200")
                  }
                >
                  <option value="">（無法判斷）</option>
                  {Object.entries(TAX_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <FieldNotes name="tax_type" item={item} onRestore={editAndCheck} />
              </label>
            </div>

            {/* 金額：像收據底部一樣靠右 */}
            <div className="mt-6 space-y-3 rounded-xl bg-slate-50 px-4 py-4">
              <Field name="sales" amount readOnly={isDual} {...shared} />
              <Field name="tax" amount readOnly={isDual} {...shared} />
              <div className="border-t border-dashed border-slate-300" />
              <Field name="total" amount strong {...shared} />
              {isDual && <p className="text-xs text-slate-500">二聯式只印總計，銷售額與稅額由總計自動反推</p>}
            </div>
          </>
        )}
      </div>

      {/* 底部：耗時費用＋確認按鈕（手機上捲動時黏在下面） */}
      {data && item.result && (
        <div className="sticky bottom-0 flex items-center gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <p className="flex-1 font-mono text-[11px] text-slate-400">
            {(item.result.meta.elapsed_ms / 1000).toFixed(1)} 秒
            {item.result.meta.cost_usd !== null && ` · US$ ${item.result.meta.cost_usd.toFixed(4)}`}
          </p>
          {item.confirmed ? (
            <>
              <span className="text-sm font-medium text-emerald-700">✓ 已確認</span>
              <button
                type="button"
                onClick={onUnconfirm}
                className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                取消確認
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onConfirm}
              className="flex items-center gap-2 rounded-xl bg-linear-to-r from-brand to-accent px-5 py-2.5 font-medium text-white shadow-md shadow-brand/25 transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:outline-none"
            >
              確認，下一張 → <Kbd>Enter</Kbd>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// 按鍵提示，例如 <Kbd>Enter</Kbd>（手機沒有鍵盤，不顯示）；審核畫面的上方也用它
export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="hidden rounded border border-current/25 px-1.5 font-mono text-[11px] leading-5 opacity-75 lg:inline">
      {children}
    </kbd>
  );
}

// 這個欄位有沒有需要確認的提醒
function hasWarn(item: QueueItem, name: FieldKey): boolean {
  return item.warnings.some((w) => w.field === name && w.level === "warn");
}

// ── 一個可以修改的欄位 ──

type FieldProps = {
  name: FieldKey;
  item: QueueItem;
  onEdit: (key: FieldKey, value: InvoiceData[FieldKey]) => void;
  onCommit: () => void; // 離開輸入框時：重新檢查
  onRestore: (key: FieldKey, value: InvoiceData[FieldKey]) => void; // 還原成 AI 原值
  amount?: boolean; // 金額：名稱在左、輸入框靠右，只能輸入數字
  strong?: boolean; // 加粗（總計）
  readOnly?: boolean; // 不能改（二聯式的銷售額、稅額）
  placeholder?: string;
};

function Field({ name, item, onEdit, onCommit, onRestore, amount, strong, readOnly, placeholder }: FieldProps) {
  const value = item.data?.[name] ?? null;

  // 輸入框裡的文字 → 欄位值：空白就是 null；金額只留下數字
  function toValue(text: string): InvoiceData[FieldKey] {
    if (amount) {
      const digits = text.replace(/\D/g, ""); // \D = 不是數字的字元，全部拿掉
      return digits === "" ? null : Number(digits);
    }
    return text === "" ? null : text;
  }

  return (
    <label className="block">
      <div className={amount ? "flex items-center justify-between gap-3" : ""}>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          {fieldLabel(name)}
          {isEdited(item, name) && <span className="rounded bg-brand-soft px-1 text-[10px] font-medium text-brand">已修改</span>}
        </span>
        <input
          value={value === null ? "" : String(value)}
          onChange={(e) => onEdit(name, toValue(e.target.value))}
          onBlur={onCommit}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} // 按 Enter 也算改完（再按一次就是確認）
          readOnly={readOnly}
          placeholder={placeholder ?? "無法辨識"}
          inputMode={amount ? "numeric" : undefined}
          spellCheck={false}
          className={
            "rounded-lg border px-3 py-2 font-mono tabular-nums outline-none placeholder:font-sans placeholder:text-slate-300 focus:border-brand focus:ring-2 focus:ring-brand/20 " +
            (amount ? "w-40 text-right " : "mt-1 w-full ") +
            (strong ? "text-lg font-semibold " : "") +
            (readOnly
              ? "border-transparent bg-transparent text-slate-500 focus:ring-0"
              : hasWarn(item, name)
                ? "border-amber-300 bg-amber-50"
                : "border-slate-200 bg-white")
          }
        />
      </div>
      <FieldNotes name={name} item={item} onRestore={onRestore} canRestore={!readOnly} />
    </label>
  );
}

// 欄位下方的說明：提醒（⚠ 黃／✓ 靛藍），以及改過的欄位顯示 AI 原值＋還原
type NotesProps = Pick<FieldProps, "name" | "item" | "onRestore"> & {
  canRestore?: boolean; // 唯讀的欄位（由系統計算）不給還原
};

function FieldNotes({ name, item, onRestore, canRestore = true }: NotesProps) {
  const notes = item.warnings.filter((w) => w.field === name);
  const original = item.result?.data[name] ?? null;

  return (
    <>
      {notes.map((w) => (
        <p key={w.message} className={"mt-1 text-xs " + (w.level === "warn" ? "text-amber-700" : "text-brand")}>
          {w.level === "warn" ? "⚠ " : "✓ 已自動修正："}
          {w.message}
        </p>
      ))}
      {isEdited(item, name) && (
        <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          <span>
            AI 原值：<span className="font-mono">{displayValue(name, original)}</span>
          </span>
          {canRestore && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault(); // 按鈕在 label 裡面，不要讓點擊跑到輸入框
                onRestore(name, original);
              }}
              className="text-brand underline-offset-2 hover:underline"
            >
              還原
            </button>
          )}
        </p>
      )}
    </>
  );
}
