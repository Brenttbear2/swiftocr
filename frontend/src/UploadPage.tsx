// 上傳畫面：還沒有發票時是一個大投放區；放入後變成「上方工具列＋發票縮圖磚牆」，點一張進入審核
import { useState } from "react";
import type { InvoiceData, ModelInfo } from "./api";
import InvoiceTile from "./InvoiceTile";
import ModelPicker from "./ModelPicker";
import ReviewPage from "./ReviewPage";
import { countWarnings, type FieldKey, type QueueItem } from "./invoice";

type Props = {
  models: ModelInfo[];
  selectedModel: string;
  onSelectModel: (id: string) => void; // 使用者選了某個模型時呼叫
  items: QueueItem[];
  onAddFiles: (files: File[]) => void; // 使用者放進檔案時呼叫
  onRetry: (item: QueueItem) => void; // 使用者按「重試」時呼叫
  onClear: () => void; // 使用者按「清除全部」時呼叫
  onEditField: (id: string, key: FieldKey, value: InvoiceData[FieldKey]) => void; // 審核時改了一個欄位
  onRecheck: (id: string, data: InvoiceData) => void; // 改完了，請後端重新檢查
  onConfirm: (id: string, confirmed: boolean) => void; // 確認／取消確認
};

export default function UploadPage(props: Props) {
  const { models, selectedModel, onSelectModel, items, onAddFiles, onRetry, onClear } = props;
  const { onEditField, onRecheck, onConfirm } = props;
  const [dragging, setDragging] = useState(false); // 是否有檔案正被拖進畫面
  const [openId, setOpenId] = useState<string | null>(null); // 正在審核的那一張（null = 在總覽）

  const ready = selectedModel !== ""; // 模型清單載入後才能上傳
  const selected = models.find((m) => m.id === selectedModel);

  // 工具列上的統計：每張只會算進其中一種
  const done = items.filter((it) => it.status === "done");
  const confirmedCount = done.filter((it) => it.confirmed).length;
  const checkCount = done.filter((it) => !it.confirmed && countWarnings(it) > 0).length;
  const todoCount = done.length - confirmedCount - checkCount; // 沒有疑問、等你看一眼
  const errorCount = items.filter((it) => it.status === "error").length;
  const pendingCount = items.length - done.length - errorCount;

  // 把瀏覽器給的檔案清單（FileList）轉成一般陣列，交給 App
  function handleFiles(list: FileList | null) {
    if (!ready || !list || list.length === 0) return;
    onAddFiles(Array.from(list));
  }

  // 用模型 id 找出顯示名稱（找不到就直接顯示 id）
  function modelLabel(id: string) {
    return models.find((m) => m.id === id)?.label ?? id;
  }

  const picker = <ModelPicker models={models} selectedModel={selectedModel} onSelect={onSelectModel} />;

  return (
    // 整個畫面都可以放檔案，不用對準某個框
    <main
      onDragOver={(e) => {
        e.preventDefault(); // 告訴瀏覽器「這裡可以放檔案」，不要自己打開它
        if (ready) setDragging(true);
      }}
      onDragLeave={(e) => {
        // 移到畫面裡的其他元素也會觸發 dragleave；真的離開畫面才算
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className="flex flex-1 flex-col"
    >
      {items.length === 0 ? (
        // ── 還沒有發票：置中的大投放區 ──
        <div className="flex flex-1 items-center justify-center bg-linear-to-b from-brand-soft to-slate-50 px-6 py-12">
          <div className="w-full max-w-3xl">
            <h1 className="text-center text-3xl font-bold tracking-tight">放入要辨識的發票</h1>
            <p className="mt-3 text-center text-slate-500">可以一次放很多張，系統會一張一張辨識，有疑問的欄位會標出來給你確認。</p>

            <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-3 shadow-xl shadow-indigo-200/50">
              {/* 模型：平常只顯示目前選的，點開才看到全部（放在上方，選單往下打開不會超出畫面） */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 pt-1 pb-3">
                {picker}
                <p className="text-sm text-slate-400">放入的發票都會用這個模型辨識</p>
              </div>

              {/* 投放區：整塊是 label，點它就等於點了裡面隱藏的檔案選擇框 */}
              <label
                className={
                  "flex flex-col items-center rounded-2xl border-2 border-dashed px-8 py-20 text-center transition has-focus-visible:ring-4 has-focus-visible:ring-brand/30 " +
                  (ready
                    ? "cursor-pointer border-slate-300 hover:border-brand hover:bg-brand-soft/60"
                    : "cursor-not-allowed border-slate-200 opacity-60")
                }
              >
                <FileInput disabled={!ready} onFiles={handleFiles} />
                <span className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-brand to-accent text-white shadow-lg shadow-brand/30">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-7">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                  </svg>
                </span>
                <p className="mt-5 text-lg font-medium text-slate-800">
                  {ready ? (
                    <>
                      拖曳發票到這裡，或<span className="text-brand underline underline-offset-4">點擊選擇檔案</span>
                    </>
                  ) : (
                    "模型清單載入中…"
                  )}
                </p>
                <p className="mt-2 text-sm text-slate-400">JPG · PNG · PDF，單檔 10MB 以內</p>
              </label>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ── 有發票了：上方工具列（捲動時固定在頂端） ── */}
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-3">
              {picker}
              <label className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-linear-to-r from-brand to-accent px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand/25 transition hover:opacity-90 has-focus-visible:ring-4 has-focus-visible:ring-brand/30">
                <FileInput disabled={!ready} onFiles={handleFiles} />
                <span className="text-base leading-none">＋</span> 加入發票
              </label>

              <p className="flex flex-wrap gap-x-3 text-sm text-slate-500">
                <span>{items.length} 張</span>
                {pendingCount > 0 && <span className="text-brand">處理中 {pendingCount}</span>}
                {checkCount > 0 && <span className="text-amber-700">需確認 {checkCount}</span>}
                {todoCount > 0 && <span className="text-slate-700">待確認 {todoCount}</span>}
                {confirmedCount > 0 && <span className="text-emerald-700">已確認 {confirmedCount}</span>}
                {errorCount > 0 && <span className="text-red-700">失敗 {errorCount}</span>}
              </p>

              <button
                type="button"
                onClick={onClear}
                className="ml-auto rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                清除全部
              </button>
            </div>
          </div>

          {/* ── 縮圖磚牆 ── */}
          <div className="mx-auto w-full max-w-7xl px-6 py-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((item) => (
                <InvoiceTile key={item.id} item={item} onOpen={() => setOpenId(item.id)} onRetry={() => onRetry(item)} />
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-slate-400">點一張開始審核 · 要加發票可以直接拖進這個畫面</p>
          </div>
        </>
      )}

      {/* 拖著檔案經過畫面時的提示（pointer-events-none：不擋住放下的動作） */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-brand/10 p-6 backdrop-blur-[2px]">
          <div className="rounded-3xl border-2 border-dashed border-brand bg-white/95 px-12 py-9 text-center shadow-2xl">
            <p className="text-xl font-semibold text-brand">放開就加入</p>
            <p className="mt-1 text-sm text-slate-500">會用 {selected?.label} 辨識</p>
          </div>
        </div>
      )}

      {/* 審核畫面：點縮圖後蓋滿整個視窗；按「回總覽」或 Esc 回到這裡 */}
      {openId !== null && (
        <ReviewPage
          items={items}
          currentId={openId}
          modelLabel={modelLabel}
          onSelect={setOpenId}
          onClose={() => setOpenId(null)}
          onEditField={onEditField}
          onRecheck={onRecheck}
          onConfirm={onConfirm}
          onRetry={onRetry}
        />
      )}
    </main>
  );
}

// 隱藏的檔案選擇框：放在 label 裡，點 label 就會打開選檔視窗
function FileInput({ disabled, onFiles }: { disabled: boolean; onFiles: (list: FileList | null) => void }) {
  return (
    <input
      type="file"
      multiple
      accept=".jpg,.jpeg,.png,.pdf"
      disabled={disabled}
      className="sr-only"
      onChange={(e) => {
        onFiles(e.target.files);
        e.target.value = ""; // 清空，下次選同一個檔案才會再觸發
      }}
    />
  );
}
