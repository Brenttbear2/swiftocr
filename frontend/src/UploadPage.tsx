// 上傳畫面：① 選擇辨識模型 ② 上傳發票（上傳功能在步驟 2-2 開放）
import type { ModelInfo } from "./api";

// 廠商代號 → 顯示名稱與標籤顏色（廠商色刻意避開綠／黃／紅，那三色留給狀態）
const VENDORS = {
  openai: { name: "OpenAI", badge: "bg-slate-100 text-slate-700" },
  google: { name: "Google", badge: "bg-sky-50 text-sky-700" },
};

type Props = {
  models: ModelInfo[];
  selectedModel: string;
  onSelectModel: (id: string) => void; // 使用者點了某個模型時呼叫
};

export default function UploadPage({ models, selectedModel, onSelectModel }: Props) {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">上傳發票</h1>
        <p className="mt-1 text-slate-500">先選擇辨識模型，再把發票放進來。</p>
      </div>

      {/* ① 選擇模型 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="flex size-6 items-center justify-center rounded-full bg-brand text-xs text-white">1</span>
          選擇辨識模型
        </h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectModel(m.id)}
              className={
                "rounded-xl border p-4 text-left transition " +
                (m.id === selectedModel
                  ? "border-brand bg-brand-soft ring-2 ring-brand/20"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50")
              }
            >
              <span className={"rounded-md px-2 py-0.5 text-xs font-medium " + VENDORS[m.category].badge}>
                {VENDORS[m.category].name}
              </span>
              <div className="mt-2 font-semibold">{m.label}</div>
              <div className="mt-0.5 text-sm text-slate-500">{m.note}</div>
            </button>
          ))}
        </div>
      </section>

      {/* ② 上傳發票（尚未開放，所以呈現停用的樣子） */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="flex size-6 items-center justify-center rounded-full bg-brand text-xs text-white">2</span>
          上傳發票
          <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-normal text-slate-500">
            下一步開放
          </span>
        </h2>

        <div className="mt-4 flex cursor-not-allowed flex-col items-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center opacity-60">
          {/* 上傳圖示 */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-10 text-slate-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
          <p className="mt-3 font-medium text-slate-600">拖曳發票到這裡，或點擊選擇檔案</p>
          <p className="mt-1 text-sm text-slate-400">JPG · PNG · PDF，單檔 10MB 以內，可一次多張</p>
        </div>
      </section>
    </main>
  );
}
