// 模型下拉選單：平常只顯示目前的模型，點開才依廠商列出全部模型與說明，最下面是「放入後自動辨識」開關
import { useEffect, useRef, useState } from "react";
import type { ModelInfo } from "./api";

// 廠商代號 → 顯示名稱（廠商不用綠／黃／紅，那三色留給狀態）
const VENDOR_NAMES = { openai: "OpenAI", google: "Google" };
const VENDOR_ORDER = ["openai", "google"] as const;

type Props = {
  models: ModelInfo[];
  selectedModel: string;
  onSelect: (id: string) => void; // 使用者選了某個模型時呼叫
  autoRecognize: boolean; // 放進來就自動辨識嗎
  onAutoRecognizeChange: (on: boolean) => void; // 切換自動辨識
};

export default function ModelPicker({ models, selectedModel, onSelect, autoRecognize, onAutoRecognizeChange }: Props) {
  const [open, setOpen] = useState(false); // 選單是否打開
  const boxRef = useRef<HTMLDivElement>(null); // 指向整個元件，用來判斷「點在外面」

  const selected = models.find((m) => m.id === selectedModel);

  // 選單打開時：點選單外面、或按 Esc，就關起來
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
    // 回傳的函式會在選單關閉時執行：把剛剛掛上的監聽拿掉
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(id: string) {
    onSelect(id);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={!selected}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-2 pr-2.5 pl-3 text-sm shadow-sm transition hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none disabled:opacity-60"
      >
        <span className="text-slate-400">模型</span>
        <span className="font-medium text-slate-800">{selected?.label ?? "載入中…"}</span>
        <svg viewBox="0 0 20 20" fill="none" className={"size-4 text-slate-400 transition " + (open ? "rotate-180" : "")}>
          <path d="M5.5 7.5L10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10">
          {VENDOR_ORDER.map((vendor) => (
            <div key={vendor} className="py-1">
              <p className="px-2.5 pt-1 pb-1.5 text-xs font-medium text-slate-400">{VENDOR_NAMES[vendor]}</p>
              {models
                .filter((m) => m.category === vendor)
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => choose(m.id)}
                    aria-pressed={m.id === selectedModel}
                    className={
                      "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition focus-visible:bg-slate-50 focus-visible:outline-none " +
                      (m.id === selectedModel ? "bg-brand-soft" : "hover:bg-slate-50")
                    }
                  >
                    <span className="min-w-0 flex-1">
                      <span className={"block text-sm font-medium " + (m.id === selectedModel ? "text-brand" : "text-slate-800")}>
                        {m.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{m.note}</span>
                    </span>
                    {/* 打勾：目前選中的模型 */}
                    {m.id === selectedModel && (
                      <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 size-4 shrink-0 text-brand">
                        <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))}
            </div>
          ))}

          {/* 開關：role="switch" 讓螢幕閱讀器知道這是開關，aria-checked 是開或關 */}
          <button
            type="button"
            role="switch"
            aria-checked={autoRecognize}
            onClick={() => onAutoRecognizeChange(!autoRecognize)}
            className="mt-1 flex w-full items-center gap-3 rounded-lg border-t border-slate-100 px-2.5 pt-3 pb-2 text-left focus-visible:bg-slate-50 focus-visible:outline-none"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-800">放入後自動辨識</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {autoRecognize ? "放進來就開始辨識" : "要按「開始辨識」才會送出"}
              </span>
            </span>
            {/* 開關的外觀：底色是軌道，白點開的時候往右移 */}
            <span className={"relative h-5 w-9 shrink-0 rounded-full transition " + (autoRecognize ? "bg-brand" : "bg-slate-300")}>
              <span
                className={
                  "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition " + (autoRecognize ? "translate-x-4" : "")
                }
              />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
