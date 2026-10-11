// 總指揮：保管各畫面共用的資料（狀態），並決定現在要顯示哪一個畫面
import { useEffect, useState } from "react";
import { getHealth, getModels, recognizeInvoice, type HealthStatus, type ModelInfo } from "./api";
import type { QueueItem } from "./invoice";
import UploadPage from "./UploadPage";
import WelcomePage from "./WelcomePage";

let nextId = 1; // 佇列項目的流水號，每放進一張就 +1

export default function App() {
  // ── 狀態 ──
  const [page, setPage] = useState<"welcome" | "upload">("welcome"); // 目前顯示的畫面
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState(""); // 選中模型的 id
  const [error, setError] = useState("");
  const [items, setItems] = useState<QueueItem[]>([]); // 放進來的發票（佇列）

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

  // ── 佇列的操作 ──

  // 修改佇列中某一張的部分欄位：不動原本的陣列，而是做出一份新的陣列交給 React
  function updateItem(id: string, changes: Partial<QueueItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  // 辨識一張：標成「辨識中」→ 呼叫後端 → 依結果標成「完成」或「失敗」
  async function recognize(id: string, file: File, model: string) {
    updateItem(id, { status: "running", model, error: "" });
    try {
      const result = await recognizeInvoice(file, model);
      updateItem(id, { status: "done", result });
    } catch (err) {
      updateItem(id, { status: "error", error: (err as Error).message });
    }
  }

  // 使用者放進檔案：先全部加入佇列，再一張一張辨識（避免同時送太多請求被限流）
  async function addFiles(files: File[]) {
    const newItems: QueueItem[] = files.map((file) => ({
      id: String(nextId++),
      file,
      // 圖片做一個瀏覽器內的暫時網址給縮圖用；PDF 瀏覽器不能直接當圖片顯示，留空
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      model: selectedModel,
      status: "waiting",
      result: null,
      error: "",
    }));
    setItems((prev) => [...prev, ...newItems]);
    for (const item of newItems) {
      await recognize(item.id, item.file, item.model);
    }
  }

  // 清除全部：先把縮圖的暫時網址還給瀏覽器（釋放記憶體），再清空佇列
  function clearAll() {
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setItems([]);
  }

  // ── 畫面 ──
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* 頂列：只有 logo，點了回到啟動畫面。啟動畫面時透明、疊在畫面上，讓右半的漸層延伸到最上面 */}
      <header className={page === "welcome" ? "absolute inset-x-0 top-0 z-10" : "border-b border-slate-200 bg-white"}>
        <div className="mx-auto flex h-16 max-w-7xl items-center px-6">
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

      {/* 依照 page 狀態，二選一顯示 */}
      {page === "welcome" ? (
        <WelcomePage onStart={() => setPage("upload")} />
      ) : (
        <UploadPage
          models={models}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          items={items}
          onAddFiles={addFiles}
          onRetry={(item) => recognize(item.id, item.file, selectedModel)}
          onClear={clearAll}
        />
      )}

      {/* 系統有問題時才出現的提示，浮在畫面下方；一切正常時什麼都不顯示 */}
      {(error || keyMissing) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex flex-col items-center gap-2 px-4">
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 shadow-lg">{error}</p>
          )}
          {keyMissing && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 shadow-lg">
              尚未設定 OpenRouter API Key，辨識功能無法使用（請檢查專案根目錄的 .env）
            </p>
          )}
        </div>
      )}
    </div>
  );
}
