// 啟動畫面：左邊一句話介紹＋開始按鈕，右邊一張辨識結果的示意卡片

// 示意卡片上的欄位（假資料，只用來展示）
const SAMPLE_FIELDS = [
  { label: "發票號碼", value: "AB12345678" },
  { label: "發票日期", value: "2026-09-12" },
  { label: "銷售額", value: "NT$ 1,000" },
  { label: "稅額", value: "NT$ 50" },
];

type Props = {
  onStart: () => void; // 按下「開始辨識發票」時要做的事（由 App 決定）
};

export default function WelcomePage({ onStart }: Props) {
  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-16 lg:grid-cols-2">
      {/* 左：標語與按鈕 */}
      <div>
        <span className="inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
          台灣統一發票 · AI 辨識
        </span>
        <h1 className="mt-5 text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
          發票辨識，
          <br />
          <span className="bg-linear-to-r from-brand to-accent bg-clip-text text-transparent">快速又可靠</span>
        </h1>
        <p className="mt-5 max-w-md text-lg text-slate-600">
          上傳發票圖片或 PDF，AI 讀取欄位、程式自動驗算，最後由你確認。
        </p>
        <button
          type="button"
          onClick={onStart}
          className="mt-8 rounded-xl bg-linear-to-r from-brand to-accent px-6 py-3 font-medium text-white shadow-lg shadow-brand/30 transition hover:opacity-90"
        >
          開始辨識發票 →
        </button>
      </div>

      {/* 右：示意卡片（淡紫漸層底） */}
      <div className="rounded-3xl bg-linear-to-br from-indigo-100 via-violet-50 to-white p-8 sm:p-12">
        <div className="rounded-2xl bg-white p-6 shadow-xl shadow-indigo-200/50">
          <div className="flex items-center justify-between">
            <span className="font-semibold">三聯式統一發票</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              已驗算
            </span>
          </div>

          <dl className="mt-5 space-y-3 text-sm">
            {SAMPLE_FIELDS.map((f) => (
              <div key={f.label} className="flex justify-between">
                <dt className="text-slate-500">{f.label}</dt>
                <dd className="font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex items-baseline justify-between border-t border-slate-100 pt-4">
            <span className="text-sm text-slate-500">總計</span>
            <span className="text-2xl font-bold text-brand">NT$ 1,050</span>
          </div>

          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠ 買方統編檢查碼不符，請人工確認
          </div>
        </div>
      </div>
    </main>
  );
}
