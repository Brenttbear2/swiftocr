// 總指揮：保管共用的資料（狀態）、管理辨識的隊伍，並把資料交給工作畫面
import { useEffect, useRef, useState } from "react";
import { checkInvoice, getHealth, getModels, recognizeInvoice, type HealthStatus, type InvoiceData, type ModelInfo } from "./api";
import { mergeWarnings, type FieldKey, type QueueItem } from "./invoice";
import { downloadReport, type ExportFormat } from "./report";
import UploadPage from "./UploadPage";

let nextId = 1; // 佇列項目的流水號，每放進一張就 +1

const AUTO_KEY = "swiftocr.autoRecognize"; // 「放入後自動辨識」存在瀏覽器裡的名稱

// 讀取上次的設定：沒存過、或瀏覽器不讓讀（例如某些無痕視窗），就用預設的「自動」
function loadAutoRecognize(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== "off";
  } catch {
    return true;
  }
}

/** 排隊等辨識的一項工作：哪一張、哪個檔案、用哪個模型 */
type Job = { id: string; file: File; model: string };

export default function App() {
  // ── 狀態 ──
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState(""); // 選中模型的 id
  const [error, setError] = useState("");
  const [items, setItems] = useState<QueueItem[]>([]); // 放進來的發票（佇列）
  const [autoRecognize, setAutoRecognize] = useState(loadAutoRecognize); // 放進來就自動辨識嗎

  // 等待辨識的隊伍，全系統只有這一條。放在 useRef 裡：它不用顯示在畫面上，
  // 而且下面的迴圈跑到一半時，也要讀得到「最新」的隊伍（useState 的值在迴圈裡是舊的）
  const queueRef = useRef<Job[]>([]);
  const runningRef = useRef(false); // 是不是已經有迴圈在處理隊伍了

  // ── 畫面第一次出現時，向後端要資料（只做一次） ──
  useEffect(() => {
    async function load() {
      try {
        const [healthResult, modelList] = await Promise.all([getHealth(), getModels()]);
        setHealth(healthResult);
        setModels(modelList);
        setSelectedModel((modelList.find((m) => m.is_default) ?? modelList[0])?.id ?? ""); // 預設模型由後端決定
      } catch (err) {
        setError((err as Error).message);
      }
    }
    load();
  }, []);

  // 沒有設定 API Key 時，辨識一定會失敗，要提醒使用者
  const keyMissing = health !== null && !health.api_key_configured;

  // 已確認、但還沒匯出的張數。資料只存在這個分頁裡，關掉就沒了
  const unsavedCount = items.filter((it) => it.confirmed && !it.exported).length;

  // 有還沒匯出的發票時，關閉或重新整理分頁前，請瀏覽器跳出「確定要離開嗎？」
  useEffect(() => {
    if (unsavedCount === 0) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault(); // 取消「直接離開」，瀏覽器就會先問使用者
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsavedCount]);

  // ── 佇列的操作 ──

  // 修改佇列中某一張的部分欄位：不動原本的陣列，而是做出一份新的陣列交給 React
  function updateItem(id: string, changes: Partial<QueueItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  // 辨識一張：標成「辨識中」→ 呼叫後端 → 依結果標成「完成」或「失敗」
  async function recognize(id: string, file: File, model: string) {
    updateItem(id, { status: "running", model, error: "", confirmed: false, exported: false });
    try {
      const result = await recognizeInvoice(file, model);
      // 目前的欄位與提醒，一開始就是 AI 的結果；result 本身另外留著，之後比對「改了哪些」
      updateItem(id, { status: "done", result, data: result.data, warnings: result.warnings });
    } catch (err) {
      updateItem(id, { status: "error", error: (err as Error).message });
    }
  }

  // 把工作排進隊伍。不管分幾次放進來，都排在同一條隊伍後面
  function enqueue(jobs: Job[]) {
    queueRef.current.push(...jobs);
    runQueue();
  }

  // 處理隊伍：一張辨識完才送下一張（避免同時送太多請求被限流），直到隊伍空了
  async function runQueue() {
    if (runningRef.current) return; // 已經有迴圈在跑：新排進來的，它會接著處理
    runningRef.current = true;
    while (queueRef.current.length > 0) {
      const job = queueRef.current.shift()!; // 從隊伍最前面拿一項出來
      await recognize(job.id, job.file, job.model);
    }
    runningRef.current = false;
  }

  // 使用者放進檔案：先全部加入佇列；自動模式就排隊辨識，手動模式等按「開始辨識」
  function addFiles(files: File[]) {
    const newItems: QueueItem[] = files.map((file) => ({
      id: String(nextId++),
      file,
      // 圖片做一個瀏覽器內的暫時網址給縮圖用；PDF 瀏覽器不能直接當圖片顯示，留空
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      model: selectedModel,
      status: autoRecognize ? "waiting" : "idle",
      result: null,
      data: null,
      warnings: [],
      confirmed: false,
      exported: false,
      error: "",
    }));
    setItems((prev) => [...prev, ...newItems]);
    if (autoRecognize) enqueue(newItems.map((item) => ({ id: item.id, file: item.file, model: selectedModel })));
  }

  // 手動模式按「開始辨識」：還沒辨識的全部排進隊伍，用「現在」選的模型依序辨識
  function startRecognize() {
    const idle = items.filter((item) => item.status === "idle");
    setItems((prev) =>
      prev.map((item) => (item.status === "idle" ? { ...item, status: "waiting", model: selectedModel } : item)),
    );
    enqueue(idle.map((item) => ({ id: item.id, file: item.file, model: selectedModel })));
  }

  // 重試一張（失敗後、或想換模型再辨識一次）：一樣排進隊伍，不插隊
  function retry(item: QueueItem) {
    updateItem(item.id, { status: "waiting", model: selectedModel, error: "" });
    enqueue([{ id: item.id, file: item.file, model: selectedModel }]);
  }

  // 移除一張還沒辨識的發票（放錯檔案時用）：先還掉縮圖的暫時網址，再從佇列拿掉
  function removeItem(id: string) {
    const item = items.find((it) => it.id === id);
    if (item) URL.revokeObjectURL(item.previewUrl);
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  // 切換「放入後自動辨識」，並記在瀏覽器裡，下次打開還是同樣的設定
  function changeAutoRecognize(on: boolean) {
    setAutoRecognize(on);
    try {
      localStorage.setItem(AUTO_KEY, on ? "on" : "off");
    } catch {
      // 瀏覽器不讓存（例如某些無痕視窗）：這次照樣能用，只是下次不會記得
    }
  }

  // ── 審核的操作 ──

  // 使用者改了一個欄位：只改畫面上的值，還不檢查（打字打到一半不用檢查）；改過就要重新匯出
  function editField(id: string, key: FieldKey, value: InvoiceData[FieldKey]) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.data ? { ...item, data: { ...item.data, [key]: value }, exported: false } : item,
      ),
    );
  }

  // 改完一個欄位（離開輸入框或選了選項）：請後端用同一套規則重新檢查
  async function recheck(id: string, sent: InvoiceData) {
    try {
      const checked = await checkInvoice(sent);
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id || !item.data) return item;
          // 等檢查結果的這段時間，使用者可能又改了別的欄位：那些欄位保留使用者的新值
          let data = checked.data;
          for (const key of Object.keys(data) as FieldKey[]) {
            if (item.data[key] !== sent[key]) data = { ...data, [key]: item.data[key] };
          }
          return { ...item, data, warnings: mergeWarnings(item, data, checked.warnings) };
        }),
      );
      setError(""); // 這次成功了：上次失敗留下的提示可以收掉
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // 按「確認」或「取消確認」
  function setConfirmed(id: string, confirmed: boolean) {
    updateItem(id, { confirmed, exported: false });
  }

  // 匯出已確認的發票，並記下「這些已經匯出過」
  function exportConfirmed(format: ExportFormat) {
    downloadReport(items, models, format);
    setItems((prev) => prev.map((item) => (item.confirmed ? { ...item, exported: true } : item)));
  }

  // 清除全部：有還沒匯出的先問一下；再把縮圖的暫時網址還給瀏覽器（釋放記憶體），清空佇列
  function clearAll() {
    if (unsavedCount > 0 && !window.confirm(`還有 ${unsavedCount} 張已確認的發票還沒匯出，清除後就找不回來了。確定要清除嗎？`)) {
      return;
    }
    queueRef.current = []; // 還在排隊的不用送了，免得白花辨識費用（正在辨識的那一張來不及取消）
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setItems([]);
  }

  // ── 畫面 ──
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* 頂列：logo 與一句話說明 */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-6">
          <span className="flex size-8 items-center justify-center rounded-md bg-brand text-white">
            {/* 閃電圖示（沿用舊版 SwiftOCR 的 logo） */}
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-[18px]">
              <path d="M12 2L4 13h6l-1 9 9-13h-6l1-9z" />
            </svg>
          </span>
          <span className="text-lg font-bold tracking-tight">
            Swift<span className="text-brand">OCR</span>
          </span>
          <span className="hidden border-l border-slate-200 pl-3 text-sm text-slate-500 sm:inline">台灣統一發票辨識與審核</span>
        </div>
      </header>

      {/* 整個系統只有這一個工作畫面：打開就能放發票 */}
      <UploadPage
        models={models}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        items={items}
        onAddFiles={addFiles}
        autoRecognize={autoRecognize}
        onAutoRecognizeChange={changeAutoRecognize}
        onStart={startRecognize}
        onRemove={removeItem}
        onRetry={retry}
        onClear={clearAll}
        onEditField={editField}
        onRecheck={recheck}
        onConfirm={setConfirmed}
        onExport={exportConfirmed}
      />

      {/* 系統有問題時才出現的提示，浮在畫面下方；一切正常時什麼都不顯示 */}
      {(error || keyMissing) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex flex-col items-center gap-2 px-4">
          {error && (
            // 外層設了 pointer-events-none（不擋住後面的畫面），這一條要能按，所以改回 auto
            <p className="pointer-events-auto flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 py-2 pr-2 pl-4 text-sm text-red-700 shadow-lg">
              {error}
              <button
                type="button"
                onClick={() => setError("")}
                aria-label="關閉提示"
                className="rounded px-1.5 py-0.5 text-red-500 hover:bg-red-100 hover:text-red-800"
              >
                ✕
              </button>
            </p>
          )}
          {keyMissing && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 shadow-lg">
              尚未設定 OpenRouter API Key，辨識功能無法使用（請檢查專案根目錄的 .env）
            </p>
          )}
        </div>
      )}
    </div>
  );
}
