// 總指揮：保管各畫面共用的資料（狀態），並決定現在要顯示哪一個畫面
import { useEffect, useState } from "react";
import { getHealth, getModels, type HealthStatus, type ModelInfo } from "./api";
import UploadPage from "./UploadPage";
import WelcomePage from "./WelcomePage";

export default function App() {
  // ── 狀態 ──
  const [page, setPage] = useState<"welcome" | "upload">("welcome"); // 目前顯示的畫面
  const [health, setHealth] = useState<HealthStatus | null>(null);
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

  // 沒有設定 API Key 時，辨識一定會失敗，要提醒使用者
  const keyMissing = health !== null && !health.api_key_configured;

  // ── 畫面 ──
  return (
    <div className="flex min-h-screen flex-col">
      {/* 頂列：只有 logo，點了回到啟動畫面 */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-6">
          <button type="button" onClick={() => setPage("welcome")} className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-brand to-accent text-white shadow-md shadow-brand/30">
              {/* 閃電圖示（沿用舊版 SwiftOCR 的 logo） */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
                <path d="M12 2L4 13h6l-1 9 9-13h-6l1-9z" />
              </svg>
            </span>
            <span className="text-lg font-bold tracking-tight">
              Swift<span className="text-brand">OCR</span>
            </span>
          </button>
        </div>
      </header>

      {/* 系統有問題時才出現的提示條；一切正常時什麼都不顯示 */}
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-2.5 text-center text-sm text-red-700">
          {error}
        </div>
      )}
      {keyMissing && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-center text-sm text-amber-800">
          尚未設定 OpenRouter API Key，辨識功能無法使用（請檢查專案根目錄的 .env）
        </div>
      )}

      {/* 依照 page 狀態，二選一顯示 */}
      {page === "welcome" ? (
        <WelcomePage onStart={() => setPage("upload")} />
      ) : (
        <UploadPage models={models} selectedModel={selectedModel} onSelectModel={setSelectedModel} />
      )}
    </div>
  );
}
