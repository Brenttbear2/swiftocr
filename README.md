# SwiftOCR：台灣統一發票辨識系統

上傳發票、單據，由AI OCR 解析發票號碼、日期、統編、金額。程式檢查相關稅務規則，並經人工確認、匯出成 CSV或JSON檔案。

<!-- 截圖：docs/images/upload.png（縮圖磚牆） -->

---

## 它能做什麼

```
上傳發票  →  AI OCR  →  規則檢查  →  審核及修改  →  匯出 CSV／JSON
```

- **多張上傳**：圖片（JPG、PNG）或 PDF 都可以，系統一張一張辨識
- **目前開放6 項AI 模型選擇**：OpenAI（GPT-4o、GPT-4o Mini、GPT-5 Mini）、Google（Gemini 3.1 Pro Preview、Gemini 3.5 Flash、Gemini 3.1 Flash Lite），預設是最便宜、最快的 Flash Lite
- **規則檢查**：統編檢查碼、金額加總、5% 稅額、日期，可疑的欄位會標黃色
- **審核介面**：左邊看原圖、右邊改欄位，按 Enter 確認並跳下一張
- **準確率統計**：系統記下你改了哪些欄位，算出每個模型的準確率
- **匯出**：只匯出你確認過的發票，附上修改紀錄

支援三種發票：三聯式統一發票、收銀機統一發票（三聯）、二聯式收銀機發票。

---

## 快速開始

### 先準備這 4 樣東西

| 項目 | 用途 | 下載 |
|---|---|---|
| Git | 下載程式碼 | https://git-scm.com/downloads |
| Python 3.11 以上 | 執行後端 | https://www.python.org/downloads/ （Windows 安裝時記得勾選「Add python.exe to PATH」） |
| Node.js 22 以上 | 打包網頁 | https://nodejs.org/ （選 LTS 版） |
| OpenRouter API key | 呼叫 AI 模型 | https://openrouter.ai/keys （註冊後儲值少量金額即可） |

> 💰 辨識會消耗 OpenRouter 的金額，每張發票辨識完，畫面上會顯示這次的實際費用（美元）。

### 步驟 0：打開終端機
- **Windows**：按開始鍵，搜尋「PowerShell」並打開
- **Mac**：按 `Command + 空白鍵`，搜尋「終端機」並打開

### 步驟 1：下載程式碼

```bash
# 把程式碼下載到目前的資料夾
git clone https://github.com/Brenttbear2/swiftocr.git

# 進入專案資料夾
cd swiftocr
```

### 步驟 2：啟動

**Windows**：在檔案總管打開 `swiftocr` 資料夾，**雙擊 `start.bat`**。

**Mac／Linux**：

```bash
python3 start.py
```

### 步驟 3：填入 API key（只有第一次）

第一次啟動時，程式會建立一個 `.env` 檔案並打開它（Windows 會用記事本打開）。把 `OPENROUTER_API_KEY=` 後面的假 key 換成你的 key，存檔：

```bash
# 把 = 後面換成你在 OpenRouter 申請的 key
OPENROUTER_API_KEY=sk-or-v1-你的key
```

關掉記事本後，程式會自動繼續。

### 步驟 4：等它準備好

第一次大約要等 2～3 分鐘，畫面會依序出現：

```
[準備 1/2] 建立 Python 虛擬環境 .venv（只有第一次）
[準備 1/2] 安裝後端套件（約 1～2 分鐘）
[準備 2/2] 安裝前端套件（約 1 分鐘）
[準備 2/2] 打包網頁

SwiftOCR 啟動中：http://127.0.0.1:8000
```

接著**瀏覽器會自動啟動**，即可進入Swift OCR 首頁

- 使用時，那個黑色（或終端機）視窗**不要關**
- 要結束時，在視窗按 `Ctrl + C`，或直接關掉視窗
- **之後每次使用，只要做步驟 2**，不會再安裝一次

<details>
<summary>不想用啟動腳本？手動執行的步驟</summary>

在專案資料夾裡依序執行：

```bash
# 1. 建立 Python 虛擬環境（專案專用的 Python，不會影響電腦裡其他程式）
python -m venv .venv            # Mac／Linux 請把 python 換成 python3

# 2. 啟用虛擬環境
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # Mac／Linux

# 3. 安裝後端套件
pip install -r backend/requirements.txt

# 4. 建立 .env：複製範本，再用編輯器填入你的 key
copy .env.example .env          # Windows
cp .env.example .env            # Mac／Linux

# 5. 安裝前端套件並打包網頁
cd frontend
npm ci
npm run build
cd ..

# 6. 啟動，然後用瀏覽器打開 http://127.0.0.1:8000
python -m uvicorn main:app --app-dir backend --port 8000
```

</details>

---

## 操作步驟

<!-- 截圖：docs/images/review.png（審核畫面） -->

1. 首頁按「**上傳發票 →**」
2. （可選）點工具列的模型按鈕，換一個 AI 模型
3. **把發票手動拖入畫面**（或按「加入發票」選檔案），系統會一張一張辨識
4. 看縮圖上的標籤：
   - 🟡 **需確認 N 項**：有欄位沒通過規則檢查，要特別看
   - ⚪ **待確認**：都通過了，看一眼就好
   - 🔴 **失敗**：可以換模型重試
5. **點一張縮圖**，進入審核畫面：左邊是原圖（點圖可放大），右邊是 AI 讀出的欄位，有錯就直接改
6. 按「**確認，下一張**」（或按 `Enter`），會自動跳到下一張
7. 全部確認完，按工具列的「**匯出**」，下載 CSV（Excel 可直接開）或 JSON

**審核畫面的快捷鍵**

| 按鍵 | 作用 |
|---|---|
| `↑` `↓` | 上一張／下一張 |
| `Enter` | 確認並跳下一張 |
| `Esc` | 回總覽 |

**其他小功能**
- 工具列「**統計**」：看每個模型的欄位準確率、平均秒數、總費用
- 不想一放進來就辨識：打開模型選單，關掉最下面的「**放入後自動辨識**」，之後要按「開始辨識」才會送出
- 資料只存在這個瀏覽器分頁裡。有確認過但還沒匯出的發票時，關掉分頁會先提醒你

---

## 常見問題

**Q：出現「port 8000 已經被別的程式佔用」**
有其他程式用了 8000 這個連接埠。找出是哪個程式並關掉它：
```bash
netstat -ano | findstr :8000    # Windows：最後一欄是程式編號（PID），到工作管理員找到它並結束
lsof -i :8000                   # Mac／Linux：找到 PID 後執行 kill <PID>
```

**Q：畫面下方出現黃色提示「尚未設定 OpenRouter API Key」，或辨識失敗說 key 無效**
打開專案資料夾裡的 `.env`，確認 `OPENROUTER_API_KEY=` 後面是你的 key（前後不要有空白），存檔後關掉視窗再啟動一次。

**Q：顯示「找不到 Python」或「找不到 Node.js」**
照「先準備這 4 樣東西」安裝。裝完要**關掉終端機再重開**，新安裝的程式才找得到。

**Q：改了程式碼，要怎麼更新畫面？**
關掉視窗，再啟動一次就好。前端程式改過的話，啟動時會自動重新打包。

**Q：想看後端有哪些 API？**
啟動後打開 http://127.0.0.1:8000/docs ，這是 FastAPI 自動產生的 API 文件，可以直接在網頁上試用。

---

## 系統如何運作

```
瀏覽器（React 網頁）
   │  上傳發票
   ▼
後端（Python FastAPI）
   │  ① PDF 先轉成圖片
   │  ② 交給 AI 讀圖  ─────→  OpenRouter（6 個 AI 模型）
   │  ③ 用程式檢查規則
   ▼
回到網頁，由人審核確認
```

**檢核規則與項目：

| 檢查 | 處理方式 |
|---|---|
| 發票類型與格式代號不符 | 🔧 自動修正：對照表是固定的 |
| 二聯式的銷售額、稅額 | 🔧 自動算：銷售額 = 總計 ÷ 1.05（四捨五入），稅額 = 總計 − 銷售額 |
| 金額有小數 | 🔧 自動四捨五入 |
| 發票號碼格式（2 個英文 + 8 個數字） | ⚠️ 只提醒，交給人判斷 |
| 統編檢查碼（含財政部 2023 年新規則） | ⚠️ 只提醒 |
| 三聯式 銷售額 + 稅額 ≠ 總計 | ⚠️ 只提醒 |
| 稅額跟 5% 差超過 1 元 | ⚠️ 只提醒 |
| 日期不存在或在未來 | ⚠️ 只提醒 |

原則：**答案能確定的才自動改，不能確定的只提醒，不替人猜。** 人改完欄位後，後端會用同一套規則再檢查一次。

---

## 技術架構與取捨

| 部分 | 使用 | 為什麼 |
|---|---|---|
| 後端 | Python 3.11、FastAPI、Pydantic | 寫法簡潔，自動產生 API 文件與資料驗證 |
| AI | OpenRouter（OpenAI 相容格式） | 一把 key 切換多家模型，方便比較品質與價格 |
| PDF | PyMuPDF | 先把 PDF 第 1 頁轉成圖片再交給 AI |
| 前端 | React 19、TypeScript、Vite、Tailwind CSS | 主流工具；TypeScript 讓前後端的資料格式一一對應 |

**為什麼用 AI 讀圖，而不是訓練專用的辨識模型？**

| | AI 讀圖（本專案） | 訓練版面辨識模型（如 Azure Document Intelligence、PaddleOCR） |
|---|---|---|
| 準備時間 | 不用訓練，馬上能用 | 要收集、標註大量樣本再訓練 |
| 換模型比較 | 改一個設定就好 | 每種方案要分別建置 |
| 可解釋性 | 較弱，只知道結果 | 較強，有信心分數與文字座標 |
| 適合 | 樣本少、想快速驗證 | 量大、長期使用、需要稽核 |

本專案樣本少、需要快速驗證，所以選 AI 讀圖，再用規則檢查和人工審核補足可靠度。

---

## 專案結構

```
swiftocr/
├── start.bat / start.py   啟動腳本（第一次會自動安裝）
├── .env.example           API key 範本，複製成 .env 後填入
├── backend/               後端（Python）
│   ├── main.py            入口：4 個 API，並提供網頁
│   ├── ai.py              PDF 轉圖、呼叫 AI
│   ├── rules.py           檢查業務規則
│   ├── schemas.py         資料格式
│   ├── config.py          設定：模型清單、檔案大小上限
│   └── prompt.py          給 AI 的指示
└── frontend/src/          前端（React）
    ├── App.tsx            總指揮：共用資料、切換畫面
    ├── UploadPage.tsx     上傳畫面：拖放、縮圖磚牆
    ├── ReviewPage.tsx     審核畫面
    ├── ReviewForm.tsx     審核表單
    └── …                  其他元件
```
