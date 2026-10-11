// 工具列上的兩個下拉選單：「統計」看 AI 的欄位準確率，「匯出」下載已確認的發票
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ModelInfo } from "./api";
import { fieldLabel, type QueueItem } from "./invoice";
import { buildReport, type ExportFormat } from "./report";

// ── 統計 ──

export function StatsMenu({ items, models }: { items: QueueItem[]; models: ModelInfo[] }) {
  const report = buildReport(items); // 沒有已確認的發票時是 null

  return (
    <Dropdown label="統計">
      <div className="w-80 max-w-[calc(100vw-2rem)] p-4">
        {report === null ? (
          <p className="text-sm leading-relaxed text-slate-500">
            還沒有已確認的發票。確認後，這裡會依你修正過的欄位算出 AI 的準確率。
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              依已確認的 {report.total.count} 張計算（共 {report.total.count * 10} 個欄位）
            </p>

            {/* 主要數字：欄位準確率 */}
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="font-mono text-4xl font-semibold tracking-tight tabular-nums">{percent(report.total.accuracy)}</p>
              <p className="pb-1 text-right text-xs text-slate-500">
                欄位準確率
                <br />
                修正了 <span className="font-mono text-slate-800">{report.total.editedFields}</span> 個欄位
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: percent(report.total.accuracy) }} />
            </div>

            <p className="mt-3 font-mono text-xs text-slate-500">
              平均 {report.total.avgSeconds.toFixed(1)} 秒 · 總成本 US$ {report.total.costUsd.toFixed(4)}
            </p>

            {report.fieldEdits.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                最常修正：
                {report.fieldEdits.map((e) => `${fieldLabel(e.key)} ${e.count}`).join("、")}
              </p>
            )}

            {/* 用了不只一個模型：每個模型分開列，方便比較 */}
            {report.byModel.length > 1 && (
              <table className="mt-4 w-full text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pb-1 text-left font-normal">模型</th>
                    <th className="pb-1 text-right font-normal">張數</th>
                    <th className="pb-1 text-right font-normal">準確率</th>
                    <th className="pb-1 text-right font-normal">秒數</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {report.byModel.map((s) => (
                    <tr key={s.model} className="border-t border-slate-100">
                      <td className="py-1.5 font-sans">{models.find((m) => m.id === s.model)?.label ?? s.model}</td>
                      <td className="py-1.5 text-right">{s.count}</td>
                      <td className="py-1.5 text-right">{percent(s.accuracy)}</td>
                      <td className="py-1.5 text-right">{s.avgSeconds.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400">
              準確率 = 沒被修正的欄位 ÷ 全部欄位。二聯式改總計時，跟著反推的銷售額、稅額也算修正。
            </p>
          </>
        )}
      </div>
    </Dropdown>
  );
}

// 0.925 → "92.5%"
function percent(value: number): string {
  return (value * 100).toFixed(1) + "%";
}

// ── 匯出 ──

type ExportProps = {
  confirmedCount: number; // 已確認幾張（會匯出的）
  unconfirmedCount: number; // 辨識完成但還沒確認幾張（不會匯出）
  onExport: (format: ExportFormat) => void;
};

export function ExportMenu({ confirmedCount, unconfirmedCount, onExport }: ExportProps) {
  const disabled = confirmedCount === 0;

  return (
    <Dropdown label="匯出" closeOnClick>
      <div className="w-72 max-w-[calc(100vw-2rem)] p-1.5">
        <p className="px-2.5 pt-1.5 pb-2 text-xs leading-relaxed text-slate-500">
          {disabled ? "確認發票後才能匯出" : `匯出 ${confirmedCount} 張已確認的發票`}
          {!disabled && unconfirmedCount > 0 && (
            <span className="block text-amber-700">還有 {unconfirmedCount} 張沒確認，不會匯出</span>
          )}
        </p>
        <ExportItem title="CSV" note="用 Excel 開啟，附修正紀錄" disabled={disabled} onClick={() => onExport("csv")} />
        <ExportItem title="JSON" note="附 AI 原值與統計，給程式讀" disabled={disabled} onClick={() => onExport("json")} />
      </div>
    </Dropdown>
  );
}

function ExportItem(props: { title: string; note: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className="flex w-full items-baseline gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <span className="w-10 font-mono text-sm font-medium text-slate-800">{props.title}</span>
      <span className="text-xs text-slate-500">{props.note}</span>
    </button>
  );
}

// ── 共用的下拉選單：點按鈕打開，點外面或按 Esc 關起來（和 ModelPicker 同樣的做法） ──

type DropdownProps = {
  label: string; // 按鈕上的字
  closeOnClick?: boolean; // 點了選單裡面的東西就關起來（匯出用；統計只是看，不用關）
  children: ReactNode; // 選單裡要放的內容
};

function Dropdown({ label, closeOnClick, children }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    // 手機上不設 relative：選單改成對齊整條工具列（離右邊 1rem），才不會超出畫面左邊
    <div ref={boxRef} className="sm:relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white py-2 pr-2 pl-3 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
      >
        {label}
        <svg viewBox="0 0 20 20" fill="none" className={"size-4 text-slate-400 transition " + (open ? "rotate-180" : "")}>
          <path d="M5.5 7.5L10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        // 靠右對齊：按鈕在工具列右邊，選單往左打開才不會超出畫面
        <div
          onClick={closeOnClick ? () => setOpen(false) : undefined}
          className="absolute top-full right-4 z-30 mt-2 sm:right-0 rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
        >
          {children}
        </div>
      )}
    </div>
  );
}
