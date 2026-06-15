# 安裝與首次使用指引

[English](INSTALL.md) · **繁體中文**

這份指引帶你從一台全新的電腦,一路設定到 NoteSentry 可正常使用。適用於
[Releases 頁面](https://github.com/swiftruru/notesentry-mcp/releases)上的預先打包安裝檔。

> **為什麼還需要先決條件。** NoteSentry 所有運算都在你本機、絕不上傳資料。App 已內附
> MCP server 腳本,但 LLM 執行環境(Ollama)、Python 執行環境、以及 MIMIC‑III 資料庫
> **不會**內附——Ollama 與 Python 是龐大且因平台而異的執行環境,而 MIMIC‑III 資料受
> PhysioNet Credentialed DUA 規範、不得轉散布。這三項由你在本機自備。

---

## 你需要準備

1. **[Ollama](https://ollama.com)** —— 本機 LLM 執行環境。
2. **Python 3** 並安裝 MCP 套件(`pip install "mcp[cli]"`)。
3. **一個 `mimic_notes.db`** —— 用你自己 credentialed 的 MIMIC‑III `NOTEEVENTS.csv` 建立。
4. 對應你平台的 **NoteSentry App**。

請預留約 10–20 GB 可用空間(模型 + 資料庫),跑 `gpt-oss:20b` 建議 ≥16 GB 記憶體。

---

## 步驟 1 —— 安裝 Ollama 並下載模型

1. 從 <https://ollama.com> 安裝 Ollama,並確認它正在執行(`ollama serve`,或直接開 Ollama App)。
2. 下載一個支援**工具呼叫(tool calling)**的模型:

   ```bash
   ollama pull gpt-oss:20b      # 建議——工具呼叫最穩定
   # 或，較低階機器可用：
   ollama pull qwen2.5
   ```

NoteSentry 只會連 `http://localhost:11434`;非本機位址會被強制阻擋。

## 步驟 2 —— 安裝 Python + MCP 套件

```bash
python3 --version              # 建議 3.10 以上
pip install "mcp[cli]"
```

記下你的 Python 路徑。多數系統用 `python3` 即可;Windows 可能是 `python` 或完整路徑,例如
`C:\Users\你\AppData\Local\Programs\Python\Python312\python.exe`。

## 步驟 3 —— 建立資料庫

你需要自己 credentialed 的 MIMIC‑III `NOTEEVENTS.csv`。從 repo 下載
[`build_db.py`](https://github.com/swiftruru/notesentry-mcp/blob/main/build_db.py)
(這支腳本也內附在 App 的 `resources/` 內),然後:

```bash
# 完整匯入（約 200 萬列）+ 建立 search_notes 用的全文檢索索引
python3 build_db.py --csv /路徑/NOTEEVENTS.csv --db mimic_notes.db --with-fts
```

記住產生出來的 `mimic_notes.db` 的**絕對路徑**——步驟 5 會在 App 裡指定它。這個檔案請留在
本機,絕不可進版控或上傳。

## 步驟 4 —— 安裝 App

### macOS

1. 下載 `NoteSentry-mac-arm64.dmg`(Apple 晶片)或 `NoteSentry-mac-x64.dmg`(Intel)。
2. 開啟 `.dmg`,把 **NoteSentry** 拖進「應用程式」。
3. 這版是 **ad‑hoc 簽章**(無付費 Apple 憑證),首次開啟會被 Gatekeeper 擋下。請對 App
   **按右鍵 → 打開 → 打開**(只需一次)。若仍被擋:系統設定 → 隱私權與安全性 →「仍要打開」。

### Windows

1. 下載 `NoteSentry-win-setup-x64.exe`(安裝版)或 `NoteSentry-win-portable-x64.exe`(免安裝)。
2. App 未簽章,SmartScreen 可能跳警告:點 **其他資訊 → 仍要執行**。
3. 安裝版可選安裝資料夾;免安裝版直接執行、不需安裝。

### Linux

- **AppImage**:`chmod +x NoteSentry-linux-x86_64.AppImage` 後執行。
  (若提示缺 FUSE,安裝 `libfuse2`,或用 `--appimage-extract-and-run` 執行。)
- **Debian/Ubuntu**:`sudo apt install ./NoteSentry-linux-amd64.deb`

## 步驟 5 —— 首次啟動與設定

開啟 NoteSentry,到左側的**設定**,填入:

| 欄位 | 填什麼 |
| --- | --- |
| **Ollama URL** | `http://localhost:11434`(預設) |
| **模型** | 從自動偵測的下拉選單挑選——例如 `gpt-oss:20b`。按**測試連線**確認 Ollama 連得上。 |
| **Python 路徑** | `python3`(或步驟 2 的完整 Python 路徑) |
| **資料庫路徑** | 步驟 3 建好的 `mimic_notes.db` 的**絕對路徑** |

接著按**重新連線 MCP**。**工具**分頁應顯示兩支 server 都已連線(MIMIC 病歷查詢 + 臨床輔助),
並列出各自的工具。

## 步驟 6 —— 驗證

在**聊天**輸入像是「總共有幾種病歷類別?」的問題。模型應發出工具呼叫,並跳出**核可對話框**
——這就是人機協作(HITL)關卡。按核可後,答案會以你的資料庫為依據回來。每次工具呼叫
(含拒絕)都會記到**稽核**分頁。

---

## 你的資料存在哪

安裝後,App 會把資料存在你作業系統的「使用者資料夾」(本機、絕不上傳):

| 作業系統 | 資料夾 |
| --- | --- |
| macOS | `~/Library/Application Support/NoteSentry/` |
| Windows | `%APPDATA%\NoteSentry\`(例:`C:\Users\你\AppData\Roaming\NoteSentry\`) |
| Linux | `~/.config/NoteSentry/` |

這個資料夾放著 `config.json`、`logs/`(稽核 JSONL)、`conversations/`(含臨床文本)。預設的
資料庫路徑也會落在這個資料夾內,所以你可把 `mimic_notes.db` 放這裡,或(建議)在設定填絕對路徑。

> **DUA 提醒。** 對話與資料庫含臨床文本,只能留在本機——不要複製到共用磁碟、雲端同步資料夾
> 或版本控制。

---

## 疑難排解

- **「找不到模型」/沒有回應** —— 先 `ollama pull gpt-oss:20b` 並確認 Ollama 正在執行,再到
  設定重新選一次模型。
- **工具分頁空白 / MCP 連不上** —— 確認 **Python 路徑**正確,且 `pip install "mcp[cli]"` 是裝在
  *那一個* Python 上;再按**重新連線 MCP**。
- **`search_notes` 查不到東西** —— 建 DB 時沒建全文檢索索引;用 `--with-fts` 重建,或對既有
  DB 單獨補建:`python3 build_db.py --db mimic_notes.db --fts-only`。
- **結果錯誤/空白** —— 設定裡的**資料庫路徑**沒指到你真正的 `mimic_notes.db`;改成絕對路徑後
  重新連線 MCP。
- **macOS 顯示「App 已損毀/無法打開」** —— ad‑hoc 簽章被 Gatekeeper 擋;用右鍵 → 打開,或
  `xattr -dr com.apple.quarantine /Applications/NoteSentry.app`。
- **模型把工具呼叫寫成純文字(沒跳核可框)** —— 改用 `gpt-oss:20b`,它能穩定發出結構化工具呼叫。
