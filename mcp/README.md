# `mcp/` — NoteSentry 的 MCP server 與資料工具

NoteSentry 透過 [Model Context Protocol](https://modelcontextprotocol.io) 連上多支本機 server。
這個目錄收納所有「MCP 相關」的 Python 程式，依角色分類，避免散落專案根目錄。

```
mcp/
  servers/    # FastMCP / stdio server，每支單檔自包含（app 以子行程啟動）
  scripts/    # 一次性工具（建置本機 SQLite）
  README.md   # 本文件
```

## servers/ — 四支 MCP server

| 檔案 | server id | 用途 | 需要 DB？ |
| --- | --- | --- | --- |
| `mimic_mcp_server.py` | `mimic` | MIMIC-III 病歷查詢（HIS）：分類、計數、病患摘要、全文檢索、取內文 | ✅ 需 `mimic_notes.db` |
| `clinical_support_mcp_server.py` | `clinical` | 臨床輔助：生命徵象規則判讀、TTAS 檢傷參考、SOAP 病歷範本 | ❌ |
| `pharmacy_support_mcp_server.py` | `pharmacy` | 用藥安全：交互作用、過敏衝突、藥物參考 | ❌ |
| `nis_fhir_mcp_server.py` | `nis` | 護理／生命徵象轉 HL7 FHIR R4 Observation、FHIR 參考 | ❌ |

**啟動模型**：app（[src/main/mcp/mcpClient.ts](../src/main/mcp/mcpClient.ts)）以
`pythonPath <scriptPath>` 啟動每支 server 的 stdio 子行程，並注入環境變數 `MIMIC_DB_PATH`（指向本機 DB）。
預設的 server 清單與腳本路徑定義在 [src/shared/types.ts](../src/shared/types.ts) 的 `DEFAULT_CONFIG.mcpServers`；
打包時由 [package.json](../package.json) 的 `build.extraResources` 一併帶入。

> **為何維持「單檔自包含」**：這些是以 `python3 <file>` 子行程啟動的獨立 server，各自把工具（`@mcp.tool`）、
> 參考知識（檢傷／藥物／FHIR 對照表）、prompt 範本都內嵌在同一檔。若拆成共用模組，會讓子行程的 import 路徑
> 在「開發 vs 打包」兩種情境下變脆弱。對這 4 支小型 server，單檔自包含最穩、也是 FastMCP 的慣用作法。
> （若日後某支 server 大幅成長，再考慮抽出 `_shared.py` 等共用模組。）

## scripts/ — 資料工具

`build_db.py`：把 MIMIC-III 的 `NOTEEVENTS.csv` 串流匯入本機 SQLite（`mimic_notes.db`）。從**專案根**執行：

```bash
python3 mcp/scripts/build_db.py --csv MIMIC-III/dataset/NOTEEVENTS.csv --db mimic_notes.db
python3 mcp/scripts/build_db.py --db mimic_notes.db --with-fts   # 建全文檢索索引
python3 mcp/scripts/build_db.py --db mimic_notes.db --fts-only   # 只補建索引
```

`mimic_notes.db` 屬使用者資料（受 PhysioNet DUA 規範、不進版控、本機建置），故**不放在 `mcp/`**，
而是依設定的 `dbPath`（預設專案根／打包後 userData）落地，由 `MIMIC_DB_PATH` 注入給 server。

## 如何新增一支 server

1. 在 `mcp/servers/` 新增 `your_mcp_server.py`（FastMCP / stdio，單檔自包含）。
2. 在 [src/shared/types.ts](../src/shared/types.ts) `DEFAULT_CONFIG.mcpServers` 加一筆
   `{ id, name, scriptPath: './mcp/servers/your_mcp_server.py', enabled: true }`。
3. 在 [package.json](../package.json) `build.extraResources` 加一筆 `from`/`to: mcp/servers/your_mcp_server.py`。
4. 重新連線（工具頁 ↻ 或設定→儲存並重連）即可看到新工具。

## 測試

server 的整合測試由 app 的 e2e 套件涵蓋（見 [e2e/](../e2e/) 的 `@live-tools`：真模型觸發工具→核可→稽核）。
未來若要為 server 加 Python 單元測試，置於 `mcp/tests/`。
