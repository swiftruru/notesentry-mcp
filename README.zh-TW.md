<div align="center">

<img src="resources/icon.png" width="120" alt="NoteSentry" />

# NoteSentry

**本機端 MIMIC‑III 臨床紀錄探索助理 —— 以本機 LLM、MCP 工具與人機協作（HITL）探索臨床紀錄。資料與推論全程留在本機。**

[![Release](https://img.shields.io/github/v/release/swiftruru/notesentry-mcp?style=flat-square&color=0D5C63&label=release)](https://github.com/swiftruru/notesentry-mcp/releases)
[![License](https://img.shields.io/github/license/swiftruru/notesentry-mcp?style=flat-square&color=0D5C63)](LICENSE)
![Platform](https://img.shields.io/badge/platform-macOS-000?style=flat-square&logo=apple&logoColor=white)
![Data](https://img.shields.io/badge/data-100%25%20local-0D5C63?style=flat-square&logo=lock&logoColor=white)
![i18n](https://img.shields.io/badge/i18n-zh--TW%20%7C%20en-247B7B?style=flat-square&logo=googletranslate&logoColor=white)

![Electron](https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-000?style=flat-square&logo=ollama&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-Model_Context_Protocol-444?style=flat-square)

[English](README.md) · **繁體中文**

</div>

---

本機端 MIMIC‑III 臨床紀錄探索助理。使用者以自然語言提問，由**本機** Ollama LLM
透過 MCP 工具查詢**本機** SQLite 資料庫，並把結果整理成回答。

> **資料全程留在本機。** 本資料受 PhysioNet Credentialed DUA 規範，禁止外流：
> 所有推論一律走本機 Ollama；每次工具呼叫前都需你親自核可（HITL）；不上傳、
> 不遙測，所有 App 資料（設定、日誌、對話）都只存在你本機。

## 下載

> 📖 **第一次使用？請看[安裝與首次使用指引](docs/INSTALL.zh-TW.md)** ——
> 從全新電腦一路帶你設定到可用（Ollama、Python、資料庫、設定）。

每個 [release](https://github.com/swiftruru/notesentry-mcp/releases) 都附上
**macOS / Windows / Linux** 三平台的安裝檔：

| 平台 | 檔案 |
| --- | --- |
| macOS | `.dmg`（安裝檔）· `.zip` —— Apple Silicon（`arm64`）與 Intel（`x64`） |
| Windows | `.exe`（NSIS 安裝檔）· 免安裝 `.exe`（`x64`） |
| Linux | `.AppImage` · `.deb`（`x64`） |

> App 已內附 MCP server 腳本，但仍需自行安裝 [Ollama](https://ollama.com) 與
> Python 3（`pip install "mcp[cli]"`），並用你自己的 credentialed MIMIC‑III 資料
> 建立 `mimic_notes.db`——見[先決條件](#先決條件)。macOS 版為 ad‑hoc 簽章（無付費
> Apple 憑證），首次開啟請用**右鍵 → 打開**。

## 聊天介面功能

接近 Claude Chat 的桌面聊天體驗：

- **多對話管理**：新增、切換、重新命名、搜尋、刪除對話；對話自動保存於
  專案資料夾 `conversations/`（含臨床文本，不離開本機），重開 app 仍在。
- **自動命名**：首輪問答後由本機 Ollama 生成簡短標題（仍可手動改名）。
- **即時串流**：回答逐字串流；可隨時「停止生成」。
- **Markdown 與程式碼**：標題、清單、表格、粗體、連結正確渲染；程式碼區塊語法高亮、可一鍵複製。
- **訊息操作**：複製整則回答；對最後一則回答「重新生成」。
- **匯出 Markdown**：把整段對話另存為 `.md`（原生「另存新檔」，可自由選擇任何位置；預設開在「文件」資料夾並記住上次所選；含工具呼叫與結果，全程本機）。
- **後續建議**：開新對話、每輪回答後、載入舊對話時，依內容產生可點擊的建議問句。
- **雙語（i18n）**：右上角一鍵切換 `繁體中文 / English`，UI、模型回答、自動標題、後續建議、匯出標籤、錯誤訊息全部跟著切；語言記憶於 `config.json`。
- **活動列版面**：最左圖示列切換 `對話 / 工具 / 稽核 / 設定 / 關於`。

### 新增語言（零元件改動）

翻譯檔在 `src/shared/locales/<lang>/<namespace>.json`（renderer 與 main 都用 `import.meta.glob`
自動收錄）。要加第三語言（如日文）只要新增 `src/shared/locales/ja/` 一整組 JSON，右上切換鈕會
自動多出該語言，**不需修改任何元件程式碼**。每個 locale 的 `common.json` 內 `language.self` /
`language.short` 提供切換鈕顯示用的名稱。

## 架構

- **Main process**（`src/main`）：握有所有「能碰資料/網路」的能力——啟動並監看
  Python MCP 子行程、列舉/呼叫 MCP 工具、呼叫本機 Ollama（串流）、跑 agent 迴圈、
  HITL 核可、寫稽核日誌、讀寫設定。
- **Preload**（`src/preload`）：以 `contextBridge` 暴露白名單化的 `window.api`。
- **Renderer**（`src/renderer`）：純 React / Tailwind UI，`contextIsolation` 開、
  `nodeIntegration` 關、`sandbox` 開；只透過 `window.api` 與 main 溝通。

資料流：`Composer → chat:send → agentLoop → Ollama 串流`，模型若回傳 `tool_calls`
則 `approvalBroker` 產生核可請求 → renderer 跳 `ApprovalDialog` →
使用者同意才 `mcpClient.callTool` → 結果回填 → 續跑，直到最終回答。每次工具呼叫
（含拒絕）都寫入稽核日誌。

## 先決條件

1. **Ollama**：`ollama serve` 執行中，並已備妥支援 tool calling 的模型（建議
   `gpt-oss:20b`；或 `ollama pull qwen2.5`。詳見下方「模型建議」）。
2. **Python + MCP**：`python3`，並安裝 MCP 套件：

   ```bash
   pip install "mcp[cli]"
   ```

3. **建立資料庫**：用內附的 `build_db.py` 把 `NOTEEVENTS.csv` 匯入 SQLite。
   （純標準函式庫，可處理數 GB 大檔，不需 pandas。）

   ```bash
   # 完整匯入（約 200 萬列；視機器數分鐘）
   python3 build_db.py --csv MIMIC-III/dataset/NOTEEVENTS.csv --db mimic_notes.db

   # 一併建立全文檢索索引（給 search_notes 用；多花數分鐘）
   python3 build_db.py --csv MIMIC-III/dataset/NOTEEVENTS.csv --db mimic_notes.db --with-fts

   # 或對既有資料庫單獨補建全文檢索索引（不必重匯）
   python3 build_db.py --db mimic_notes.db --fts-only

   # 先用一小段測試（前 2 萬列）
   python3 build_db.py --db mimic_notes_test.db --limit 20000 --rebuild
   ```

> 本專案已內附兩支 MCP server（FastMCP / stdio）與 `build_db.py`。app 會同時連上
> 多支 server（對應簡報的多 MCP 架構），工具依名稱路由到對的 server。

### MCP server 與工具一覽（兩支 server，皆唯讀／無副作用）

**`mimic_mcp_server.py` — MIMIC 病歷查詢**（需 `mimic_notes.db`）

| 工具 | 用途 |
| --- | --- |
| `list_note_categories` | 各類別（CATEGORY）筆數總覽 |
| `count_notes` | 依類別 / 病患 / DESCRIPTION 關鍵字計數 |
| `get_patient_overview` | 單一病患（SUBJECT_ID）的紀錄摘要 |
| `search_notes` | **全文檢索**內文（TEXT），回傳命中片段（需先建 FTS 索引） |
| `get_note_text` | 依 ROW_ID 取單筆完整內文 |

**`clinical_support_mcp_server.py` — 臨床輔助（不需資料庫）**

| 工具 | 用途 | 對應應用 |
| --- | --- | --- |
| `assess_vital_signs` | 純規則判讀生命徵象、標出危急紅旗（零幻覺、可重現） | A 檢傷 |
| `get_ttas_reference` | TTAS 五級檢傷判定原則 + 主訴紅旗（內建知識） | A 檢傷 |
| `get_soap_template` | SOAP 病歷結構與各段內容指引 | B 病歷 |

> 設計原則：檢傷分級與 SOAP 擴寫由 **LLM 推理**，這些工具只把判斷「接地」到確定性
> 依據（規則化生命徵象、官方檢傷標準、固定格式），最終仍由**醫護人類覆核**。
> 對應簡報「MCP 接地 → LLM 推理 → 人類覆核」的三層防線。

### MCP server 整合約定（重要）

App 啟動 MCP server 的方式為：

```text
<pythonPath> <mcpScriptPath>     # 例：python3 ./mimic_mcp_server.py
```

並透過**環境變數 `MIMIC_DB_PATH`** 傳入 SQLite 資料庫的絕對路徑。請確認
`mimic_mcp_server.py` 會讀取此環境變數來定位資料庫，例如：

```python
import os
DB_PATH = os.environ.get("MIMIC_DB_PATH", "mimic_notes.db")
```

若你的 server 是用其他方式（硬編碼路徑或 CLI 參數）取得 DB 路徑，請對齊成讀取
`MIMIC_DB_PATH`，或自行調整設定頁中的腳本路徑指向已內含正確路徑的啟動腳本。

## 開發與執行

```bash
npm install
npm run dev          # 開發模式（HMR）
npm run build        # 產出 out/
npm start            # 建置後以 preview 啟動
npm run typecheck
npm run package      # 打包成可散布的 App（electron-builder）
```

> 註：若你的終端機環境設了 `ELECTRON_RUN_AS_NODE=1`（某些 Electron 系工具會設），
> Electron 會以純 Node 執行而非 GUI。請在乾淨的終端機執行，或
> `env -u ELECTRON_RUN_AS_NODE npm start`。

## App 圖示與名稱（macOS）

- 圖示放在 `build/icon.png`（打包用）與 `resources/icon.png`（執行期載入）；
  打包時 electron-builder 會生成 `.icns`。
- macOS 在 `npm run dev` 下，Dock 名稱、選單列粗體名稱與「關於」面板圖示是讀「正在執行的
  `Electron.app` bundle」——`app.setName()` 改不動它。本專案用
  [scripts/patch-dev-name.mjs](scripts/patch-dev-name.mjs) 在每次 `npm run dev` 前（`predev`）
  自動把 Electron bundle 的 `CFBundleName` 與圖示改成 NoteSentry，因此 dev 下名稱與圖示皆正確。
  變更後若被系統快取，完全退出 Electron 再 `npm run dev` 一次即可。
- 打包後的 `.app` 由 `productName` / `build.icon` 控制，名稱與圖示一律正確。

## 設定

設定存於專案根的 `config.json`（首次啟動自動產生），亦可在 App 的「設定」分頁修改：

| 欄位 | 預設 | 說明 |
| --- | --- | --- |
| `ollamaUrl` | `http://localhost:11434` | 僅允許本機位址（強制守門） |
| `model` | `gpt-oss:20b` | 需支援 tool calling（見下方建議） |
| `pythonPath` | `python3` | 啟動所有 MCP server 的 Python |
| `dbPath` | `./mimic_notes.db` | SQLite 資料庫路徑，經 `MIMIC_DB_PATH` 傳給各 server |
| `language` | `zh-TW` | 介面與模型回答語言（右上角切換鈕亦可改） |
| `mcpServers[]` | mimic + clinical | 多個 MCP server（id / name / scriptPath / enabled） |

### 模型建議（工具呼叫穩定度）

HITL 能否可靠跳出，取決於模型是否發出「結構化工具呼叫」而非用文字描述。實測（同一題、
同樣的強化 prompt）：

- **`gpt-oss:20b`（建議，預設）**：原生 function calling，穩定發出結構化工具呼叫，且最快
  （約 25 秒到第一次工具呼叫）。已安裝免下載。
- **`qwen2.5`**：輕量（7B）、工具呼叫可靠，適合較低階機器（`ollama pull qwen2.5`）。
- **`qwen3.6:27b`**：可用，但偏推理型、較慢，偶爾會把工具呼叫寫成文字（HITL 就不會跳）。

> agent 迴圈已用 `temperature: 0.3` 並把「可用工具清單」接進 system prompt（禁止杜撰資料表、
> 禁止用文字描述工具呼叫），大幅降低臆造與漏跳 HITL 的機率（見
> [agentLoop.ts](src/main/agent/agentLoop.ts)）。

## 稽核日誌

每次工具呼叫（時間、工具名、參數、是否核可、結果摘要/錯誤）都會：

- 即時顯示在「稽核」分頁；
- 追加寫入 `logs/audit-YYYY-MM-DD.jsonl`（每行一筆，永不離開專案資料夾）。

## 安全要點

- 僅連線本機 Ollama；`ollamaUrl` 非 localhost / 127.0.0.1 會被阻擋。
- 渲染端 CSP 僅允許 `'self'` 與本機 Ollama 連線；停用外開連結與導航。
- 工具呼叫一律需人工核可，無「全部允許」繞過途徑。
- `config.json`、`logs/`、`conversations/`、`exports/`、資料庫與 MIMIC 資料集皆已列入
  `.gitignore`，含臨床文本的檔案不會進版控。

## 技術堆疊

Electron · React · TypeScript · Tailwind CSS · zustand · react-i18next ·
Model Context Protocol（`@modelcontextprotocol/sdk`）· Ollama · SQLite（FTS5）· FastMCP（Python）

## 授權與致謝

- 作者：潘昱如（YU-RU, PAN）· 資料決策分析實驗室（Data Decision Analysis Laboratory）·
  國立臺北護理健康大學 資訊管理系所
- 資料來源：MIMIC-III Clinical Database（PhysioNet）。使用本資料須符合 PhysioNet
  Credentialed 資料使用協議（DUA）；資料集與任何含臨床文本的衍生檔案不得外流或進版控。
- 授權：MIT（程式碼）。
