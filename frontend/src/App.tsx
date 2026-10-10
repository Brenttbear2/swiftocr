// 工作台總指揮：存放畫面需要的資料（狀態），並決定畫面長什麼樣子
// 步驟 2-1：先確認前端連得上後端，並列出可選的模型
import { useEffect, useState } from "react";
import { getHealth, getModels, type HealthStatus, type ModelInfo } from "./api";

// 廠商代號 → 畫面上顯示的名稱
const VENDOR_NAMES = { openai: "OpenAI", google: "Google" };

export default function App() {
  // ── 狀態：會改變、而且一改變畫面就要跟著更新的資料 ──
  const [health, setHealth] = useState<HealthStatus | null>(null); // 還沒拿到前是 null
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState(""); // 選中模型的 id
  const [error, setError] = useState("");

  // ── 畫面第一次出現時，向後端要資料（只做一次） ──
  useEffect(() => {
    async function load() {
      try {
        const [healthResult, modelList] = await Promise.all([getHealth(), getModels()]);
        setHealth(healthResult);
        setModels(modelList);
        setSelectedModel(modelList[0]?.id ?? "");
      } catch (err) {
        setError((err as Error).message);
      }
    }
    load();
  }, []);

  // 從清單中找出目前選中的那個模型（找不到是 undefined）
  const selected = models.find((m) => m.id === selectedModel);

  // ── 畫面 ──
  return (
    <div className="min-h-screen bg-stone-100 text-stone-800">
      <header className="border-b border-stone-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold">發票 OCR 審核工作台</h1>
        <p className="text-sm text-stone-500">v2 前端（React）· 步驟 2-1：連上後端</p>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-6">
        {/* 卡片 1：後端狀態 */}
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">後端狀態</h2>
          {error && <p className="text-red-600">❌ {error}</p>}
          {!error && health === null && <p className="text-stone-500">連線中…</p>}
          {health && (
            <ul className="space-y-1">
              <li>✅ 後端連線正常</li>
              <li>
                {health.api_key_configured
                  ? "✅ 已設定 OpenRouter API Key"
                  : "⚠️ 尚未設定 OpenRouter API Key（請檢查專案根目錄的 .env）"}
              </li>
            </ul>
          )}
        </section>

        {/* 卡片 2：模型清單 */}
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">可選的辨識模型（{models.length} 個）</h2>

          <select
            className="w-full rounded border border-stone-300 px-3 py-2"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {VENDOR_NAMES[m.category]} · {m.label}
              </option>
            ))}
          </select>

          {selected && (
            <p className="mt-2 text-sm text-stone-500">
              {selected.note}　<code className="text-xs">{selected.id}</code>
            </p>
          )}

          {/* 同一份狀態的第二種呈現：點表格的列也能切換模型 */}
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-stone-500">
              <tr>
                <th className="py-1">廠商</th>
                <th className="py-1">模型</th>
                <th className="py-1">說明</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className={
                    "cursor-pointer border-t border-stone-100 " +
                    (m.id === selectedModel ? "bg-red-50 font-medium" : "hover:bg-stone-50")
                  }
                >
                  <td className="py-1.5">{VENDOR_NAMES[m.category]}</td>
                  <td className="py-1.5">{m.label}</td>
                  <td className="py-1.5 text-stone-500">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
