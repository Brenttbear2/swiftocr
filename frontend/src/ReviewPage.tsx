// 審核畫面：蓋滿整個視窗，左邊看原圖、右邊核對與修改欄位，一張一張確認（可以全用鍵盤操作）
import { useEffect, useRef, useState } from "react";
import type { InvoiceData } from "./api";
import { StatusBadge } from "./InvoiceTile";
import { imageUrl, type FieldKey, type QueueItem } from "./invoice";
import ReviewForm, { Kbd } from "./ReviewForm";

type Props = {
  items: QueueItem[];
  currentId: string; // 正在審核哪一張
  modelLabel: (id: string) => string; // 模型 id → 顯示名稱
  onSelect: (id: string) => void; // 換到另一張
  onClose: () => void; // 回到總覽
  onEditField: (id: string, key: FieldKey, value: InvoiceData[FieldKey]) => void;
  onRecheck: (id: string, data: InvoiceData) => void;
  onConfirm: (id: string, confirmed: boolean) => void;
  onRetry: (item: QueueItem) => void;
};

const STAMP_MS = 650; // 按確認後，「已確認」印章停留多久才換下一張（毫秒）

export default function ReviewPage(props: Props) {
  const { items, currentId, modelLabel, onSelect, onClose, onEditField, onRecheck, onConfirm, onRetry } = props;
  const [stamping, setStamping] = useState(false); // 剛按確認，原圖上正在蓋「已確認」印章
  const timer = useRef(0); // 印章計時器的編號（不用顯示在畫面上，所以用 useRef 而不是 useState）
  const index = items.findIndex((it) => it.id === currentId);
  const item = items[index];
  const confirmedCount = items.filter((it) => it.confirmed).length;
  const canConfirm = item?.status === "done" && !item.confirmed; // 現在能不能按「確認」

  // 換到第 i 張（超出範圍、或印章還在播，就不動）
  function goTo(i: number) {
    if (stamping || i < 0 || i >= items.length) return;
    onSelect(items[i].id);
  }

  // 確認這張 → 蓋印章 → 跳到下一張「辨識完成、還沒確認」的（往後找，找到底再從頭找）；全部確認完就回總覽
  function confirmAndNext() {
    if (!item || stamping) return;
    onConfirm(item.id, true);
    const others = [...items.slice(index + 1), ...items.slice(0, index)];
    const next = others.find((it) => it.status === "done" && !it.confirmed);
    const leave = () => (next ? onSelect(next.id) : onClose());

    // 系統設定了「減少動態效果」的人：不播印章，直接換
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      leave();
      return;
    }
    setStamping(true);
    timer.current = window.setTimeout(() => {
      setStamping(false);
      leave();
    }, STAMP_MS);
  }

  // 離開審核畫面時，取消還沒跑完的印章計時，不然時間到了它會把審核畫面又打開
  useEffect(() => () => clearTimeout(timer.current), []);

  // 鍵盤：Esc 回總覽、↑↓ 上一張／下一張、Enter 確認並跳下一張
  // 這裡故意不寫依賴陣列：每次畫面更新都重新掛一次，監聽函式才拿得到最新的 index、item
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.altKey || e.metaKey) return; // 組合鍵（例如 Ctrl+C）留給瀏覽器
      const target = e.target as HTMLElement;
      const editing = target.matches("input, select, textarea"); // 焦點在輸入框或下拉選單裡

      if (e.key === "Escape") {
        if (editing) target.blur(); // 正在輸入：先離開輸入框（會觸發重新檢查），再按一次才回總覽
        else onClose();
      } else if (editing) {
        return; // 方向鍵、Enter 留給輸入框和下拉選單自己用
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault(); // 不要讓方向鍵順便捲動畫面
        goTo(e.key === "ArrowUp" ? index - 1 : index + 1);
      } else if (e.key === "Enter" && canConfirm && !e.repeat && target.tagName !== "BUTTON") {
        // 焦點在按鈕上時，Enter 是「按那顆按鈕」，不另外確認；e.repeat：按住不放只算一次
        e.preventDefault();
        confirmAndNext();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  if (!item) return null; // 這張已經被清除了

  return (
    <div role="dialog" aria-modal="true" aria-label="審核發票" className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ── 上方：回總覽、上一張／下一張、進度 ── */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 px-4">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          ← 回總覽
          <Kbd>Esc</Kbd>
        </button>

        <div className="mx-auto flex items-center gap-1">
          <NavButton label="上一張（↑）" disabled={index === 0} onClick={() => goTo(index - 1)}>
            ‹
          </NavButton>
          <span className="w-16 text-center font-mono text-sm tabular-nums text-slate-600">
            {index + 1} / {items.length}
          </span>
          <NavButton label="下一張（↓）" disabled={index === items.length - 1} onClick={() => goTo(index + 1)}>
            ›
          </NavButton>
        </div>

        <span className="hidden text-sm text-slate-500 sm:inline">
          已確認 <span className="font-mono tabular-nums">{confirmedCount}</span> / {items.length}
        </span>
        <StatusBadge item={item} />
      </div>

      {/* ── 下方：左原圖、右表單（手機上改成上下排） ── */}
      <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_30rem] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
        {/* key：換張時重新建立看圖區，放大倍率自動回到「適合畫面」 */}
        <ImageViewer key={item.id} item={item} stamped={stamping} />
        <div className="border-slate-200 lg:min-h-0 lg:border-l">
          <ReviewForm
            item={item}
            modelLabel={modelLabel(item.model)}
            onEdit={(key, value) => onEditField(item.id, key, value)}
            onRecheck={(data) => onRecheck(item.id, data)}
            onConfirm={confirmAndNext}
            onUnconfirm={() => onConfirm(item.id, false)}
            onRetry={() => onRetry(item)}
          />
        </div>
      </div>
    </div>
  );
}

// 上一張／下一張的小按鈕
function NavButton(props: { label: string; disabled: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="flex size-9 items-center justify-center rounded-lg text-xl text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {props.children}
    </button>
  );
}

// ── 看原圖：深色底襯托白色的發票，可以放大後拖捲軸看細節 ──

const ZOOMS = [1, 1.5, 2, 3]; // 1 = 適合畫面；其他是畫面寬度的幾倍

function ImageViewer({ item, stamped }: { item: QueueItem; stamped: boolean }) {
  const [zoom, setZoom] = useState(1);
  const src = imageUrl(item);
  const step = ZOOMS.indexOf(zoom);
  const fit = zoom === 1;

  return (
    <div className="relative h-[45vh] bg-slate-800 lg:h-full">
      {src ? (
        <div className={"size-full overflow-auto overscroll-contain p-6 " + (fit ? "flex items-center justify-center" : "")}>
          <img
            src={src}
            alt={`發票原圖：${item.file.name}`}
            onClick={() => setZoom(fit ? 2 : 1)} // 點圖片：適合畫面 ↔ 放大 2 倍
            style={fit ? undefined : { width: `${zoom * 100}%` }}
            className={
              "rounded-sm shadow-2xl shadow-black/40 " +
              (fit ? "max-h-full max-w-full cursor-zoom-in object-contain" : "max-w-none cursor-zoom-out")
            }
          />
        </div>
      ) : (
        <p className="flex size-full items-center justify-center px-6 text-center text-sm text-slate-400">
          {item.status === "error" ? "辨識失敗，無法顯示原圖" : "PDF 辨識完成後會顯示原圖"}
        </p>
      )}

      {/* 確認時蓋上的印章：從大到小「蓋」下去（動畫定義在 index.css 的 stamp） */}
      {stamped && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-emerald-950/25">
          <p className="animate-stamp rounded-2xl border-4 border-emerald-500 bg-white/95 px-8 py-3 text-3xl font-bold tracking-widest text-emerald-600 shadow-2xl">
            ✓ 已確認
          </p>
        </div>
      )}

      {/* 放大縮小 */}
      {src && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center rounded-full bg-slate-900/85 p-1 text-sm text-white shadow-lg">
          <button
            type="button"
            aria-label="縮小"
            disabled={step === 0}
            onClick={() => setZoom(ZOOMS[step - 1])}
            className="size-8 rounded-full hover:bg-white/15 disabled:opacity-30"
          >
            －
          </button>
          <button type="button" onClick={() => setZoom(1)} className="min-w-20 rounded-full px-2 py-1 hover:bg-white/15">
            {fit ? "適合畫面" : `${zoom} 倍`}
          </button>
          <button
            type="button"
            aria-label="放大"
            disabled={step === ZOOMS.length - 1}
            onClick={() => setZoom(ZOOMS[step + 1])}
            className="size-8 rounded-full hover:bg-white/15 disabled:opacity-30"
          >
            ＋
          </button>
        </div>
      )}
    </div>
  );
}
