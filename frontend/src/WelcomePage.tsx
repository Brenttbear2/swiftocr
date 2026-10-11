// 啟動畫面：左半白底放說明＋上傳按鈕，右半滿版漸層示意「紙本發票被掃描成資料」

// 示意用的二聯式收銀機發票（虛構店家與統編，統編可通過檢查碼）
const RECEIPT_LINES = [
  { text: "晨光咖啡 敦南店", strong: true },
  { text: "統一發票（二聯式）" },
  { text: "113年07-08月" },
  { text: "AB-12345678", strong: true },
  { text: "113-07-26 08:42" },
  { text: "賣方 12345675" },
  { text: "美式咖啡 x1      60" },
  { text: "可頌     x1      40" },
  { text: "總計            100", strong: true },
];

// 掃描後得到的資料（tone：ok = 讀到、fixed = 系統自動修正）
const RESULT_ROWS = [
  { label: "發票類型", value: "二聯式收銀機發票", tone: "ok" },
  { label: "發票號碼", value: "12345678", prefix: "AB", tone: "ok", mono: true },
  { label: "開立日期", value: "2024-07-26", note: "民國 113 年轉西元", tone: "fixed", mono: true },
  { label: "賣方統編", value: "12345675", note: "檢查碼正確", tone: "ok", mono: true },
  { label: "銷售額／稅額", value: "95 ／ 5", note: "依總計反推", tone: "fixed", mono: true },
  { label: "總計", value: "NT$ 100", tone: "ok", mono: true },
];

const SUPPORTED_TYPES = ["三聯式", "收銀機三聯", "二聯式"];

type Props = {
  onStart: () => void; // 按下「上傳發票」時要做的事（由 App 決定）
};

export default function WelcomePage({ onStart }: Props) {
  return (
    <main className="grid flex-1 lg:grid-cols-2">
      {/* 左：說明與按鈕（大螢幕時靠右，貼近畫面中線） */}
      <div className="flex items-center bg-white px-6 pt-28 pb-16 lg:justify-end lg:px-16 lg:py-24">
        <div className="w-full max-w-xl">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            支援
            {SUPPORTED_TYPES.map((t) => (
              <span key={t} className="rounded-md border border-slate-200 px-2 py-0.5 font-medium text-slate-700">
                {t}
              </span>
            ))}
            統一發票
          </div>

          <h1 className="mt-7 text-4xl leading-[1.12] font-black tracking-tight sm:text-5xl xl:text-6xl">
            把紙本發票，
            <br />
            變成<span className="bg-linear-to-r from-brand to-accent bg-clip-text text-transparent">可以核對的資料</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-600">
            AI 讀出發票欄位，系統再驗算統編、稅額與日期，有疑問的地方會標出來給你確認。
          </p>

          <div className="mt-10 flex items-center gap-4">
            <button
              type="button"
              onClick={onStart}
              className="rounded-xl bg-linear-to-r from-brand to-accent px-7 py-3.5 text-lg font-medium text-white shadow-lg shadow-brand/30 transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:outline-none"
            >
              上傳發票 →
            </button>
            <span className="text-sm text-slate-400">JPG · PNG · PDF</span>
          </div>
        </div>
      </div>

      {/* 右：紙條被掃描 → 資料卡（動畫只在進入時播放一次） */}
      <div className="relative flex items-center justify-center overflow-hidden bg-linear-to-br from-brand to-accent px-6 py-16 lg:py-24">
        {/* 背景：點狀紋路＋右上角一團光暈 */}
        <div className="dot-grid absolute inset-0" />
        <div className="absolute -top-32 -right-32 size-[28rem] rounded-full bg-white/15 blur-3xl" />

        <div className="relative flex flex-col items-center gap-8 sm:flex-row">
          {/* 紙條 */}
          <div className="w-60 shrink-0 -rotate-3 drop-shadow-2xl">
            <div className="relative overflow-hidden bg-white px-5 pt-6 pb-4 font-mono text-xs leading-7 text-slate-600">
              {RECEIPT_LINES.map((line) => (
                <p key={line.text} className={"whitespace-pre " + (line.strong ? "font-semibold text-slate-900" : "")}>
                  {line.text}
                </p>
              ))}
              {/* 掃描光：減少動態效果的設定下不顯示 */}
              <div className="pointer-events-none absolute inset-x-0 h-12 -translate-y-full border-b-2 border-accent bg-linear-to-b from-transparent to-brand/15 opacity-0 motion-safe:animate-scan" />
            </div>
            <div className="receipt-edge" />
          </div>

          {/* 資料卡 */}
          <div className="w-72 rounded-2xl bg-white p-5 shadow-2xl shadow-indigo-950/30">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-medium text-slate-500">辨識結果</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">完成</span>
            </div>
            <dl className="mt-1">
              {RESULT_ROWS.map((row, i) => (
                <div
                  key={row.label}
                  className="border-b border-dashed border-slate-100 py-2 last:border-0 motion-safe:animate-reveal"
                  style={{ animationDelay: `${0.7 + i * 0.32}s` }}
                >
                  <dt className="text-xs text-slate-500">{row.label}</dt>
                  <dd className={"font-medium " + (row.mono ? "font-mono tabular-nums" : "")}>
                    {row.prefix && (
                      <span className="mr-1 rounded bg-slate-900 px-1 py-px text-[0.8em] text-white">{row.prefix}</span>
                    )}
                    {row.value}
                  </dd>
                  {row.note && (
                    <p className={"text-xs " + (row.tone === "fixed" ? "text-brand" : "text-emerald-600")}>
                      ✓ {row.note}
                    </p>
                  )}
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </main>
  );
}
