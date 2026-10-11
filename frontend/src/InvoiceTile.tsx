// 縮圖磚：一張發票的原圖縮圖、號碼、總計與狀態；點一下看完整欄位
import { InvoiceNumber, StatusBadge } from "./ResultCard";
import { countWarnings, displayValue, type QueueItem } from "./invoice";

type Props = {
  item: QueueItem;
  onOpen: () => void; // 點縮圖：打開完整結果
  onRetry: () => void; // 失敗時按「重試」
};

export default function InvoiceTile({ item, onOpen, onRetry }: Props) {
  const data = item.result?.data;
  const warnCount = countWarnings(item);
  const busy = item.status === "waiting" || item.status === "running";

  // 外框顏色跟著狀態：需確認是黃、失敗是紅，其他是灰
  const border =
    item.status === "error"
      ? "border-red-200"
      : warnCount > 0
        ? "border-amber-300"
        : "border-slate-200 hover:border-slate-300";

  return (
    <article className={"group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md " + border}>
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:outline-none focus-visible:ring-inset"
      >
        {/* 縮圖：圖片顯示原圖上半部（號碼通常在上面），PDF 顯示圖示 */}
        <div className="relative aspect-[4/5] overflow-hidden bg-slate-100">
          {item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt=""
              className="size-full object-cover object-top transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-slate-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" className="size-12">
                <path strokeLinejoin="round" d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
                <path strokeLinejoin="round" d="M14 3v5h5" />
              </svg>
              <span className="font-mono text-xs font-semibold tracking-widest">PDF</span>
            </div>
          )}

          {/* 還沒辨識完：縮圖蓋一層白霧；辨識中再加上來回的掃描光 */}
          {busy && <div className="absolute inset-0 bg-white/50" />}
          {item.status === "running" && (
            <div className="pointer-events-none absolute inset-x-0 h-16 -translate-y-full border-b-2 border-accent bg-linear-to-b from-transparent to-brand/20 motion-safe:animate-scan-loop" />
          )}

          <div className="absolute top-2 right-2 shadow-sm">
            <StatusBadge item={item} warnCount={warnCount} />
          </div>
        </div>

        {/* 文字：完成後顯示號碼、日期、總計；之前顯示檔名 */}
        <div className="px-3.5 py-3">
          {data ? (
            <>
              <p className="truncate font-mono text-sm font-medium">
                {data.invoice_number ? (
                  <InvoiceNumber value={data.invoice_number} />
                ) : (
                  <span className="text-slate-300">號碼無法辨識</span>
                )}
              </p>
              <p className="mt-1 flex items-baseline justify-between gap-2 font-mono text-xs tabular-nums">
                <span className="text-slate-500">{data.date ?? "—"}</span>
                <span className="font-semibold text-slate-900">{displayValue("total", data.total)}</span>
              </p>
            </>
          ) : (
            <>
              <p className="truncate text-sm font-medium text-slate-700">{item.file.name}</p>
              <p className="mt-1 font-mono text-xs text-slate-400">{Math.ceil(item.file.size / 1024)} KB</p>
            </>
          )}
        </div>
      </button>

      {/* 失敗：原因（最多兩行）＋重試 */}
      {item.status === "error" && (
        <div className="flex items-start gap-2 border-t border-red-100 bg-red-50 px-3.5 py-2.5">
          <p className="line-clamp-2 flex-1 text-xs text-red-700">{item.error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-medium text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-100"
          >
            重試
          </button>
        </div>
      )}
    </article>
  );
}
