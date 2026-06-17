# NoteSentry 全自動 UI 測試（Playwright + Electron）

用 [Playwright](https://playwright.dev) 的 `_electron` 啟動器，直接啟動「打包後的真實 app」並驅動 renderer。
第一版**全離線**（不需 Ollama／MCP），聚焦純前端互動回歸。

## 怎麼跑

```bash
npm test                 # 建置 + 跑離線套件（pretest 會先 npm run build）
npm run test:headed      # 同上，但開視窗看畫面
npm run test:ui          # Playwright UI 模式（可逐步檢視、看 trace）
npm run test:debug       # PWDEBUG 偵錯
npm run test:report      # 看上次的 HTML 報告
```

首次需安裝瀏覽器相依：`npx playwright install`（Electron 測試本身用 app 自帶的 Electron，
但 Playwright 仍需一次性安裝）。

## 架構

```
playwright.config.ts      # 專案設定：offline（預設）/ live（第二階段）兩個 project
e2e/
  fixtures/
    electronApp.ts        # 啟動/關閉真實 app（隔離 NS_DATA_DIR、移除 ELECTRON_RUN_AS_NODE、抑制首啟導覽）
    test.ts               # 擴充 test：per-worker 啟動 + 注入各 POM
  pages/                  # Page Object Model：每個 view/dialog 一個類別，選擇器知識集中於此
  specs/                  # 測試案例：用 POM 宣告式撰寫
```

- **隔離**：每個 worker 啟動一個 app，資料根指到 `os.tmpdir()` 的暫存資料夾（`NS_DATA_DIR`），
  跑完即刪，**不會動到專案根的 `config.json`**。
- **導覽抑制**：首啟特色導覽會自動彈出並用全螢幕遮罩擋點擊；啟動時已設 `localStorage.ns.tourSeen='1'`
  並關掉它（`electronApp.ts` 的 `suppressTour`）。

## 選擇器規約（維護性骨幹）

1. **一律用 `data-testid` 找元素**，命名 `<area>-<thing>[-<dynamicKey>]`（kebab）。
   例：`rail-item-settings`、`settings-tab-appearance`、`appearance-font-lg`、`appearance-hc-switch`、
   `command-item-goAudit`、`conversation-item-<id>`。
2. **狀態用既有 ARIA 斷言**（不另設 testid）：`aria-current="page"`（導覽作用中）、
   `aria-selected`（分頁）、`aria-pressed`（字級鈕）、`aria-checked`（高對比開關）。
3. **禁止**用翻譯文字或 Tailwind class 當選擇器——所有可見文字都經 i18n（zh-TW/en），會隨語系/改版而變。
   斷言內容時只用測試自己塞入的 ASCII 值（如種子對話標題）。
4. spec 不要從 fixture 取 `page`（那是 Playwright 預設瀏覽器頁）；改用 POM 的 `.page`（Electron 視窗）。

## 擴充 playbook（新功能落地後加測試的三步）

1. 在新功能的互動元素加 `data-testid`（照上面規約；狀態盡量用 ARIA）。
2. 在 `e2e/pages/` 新增或擴充一個 POM，方法以使用者意圖命名（`open()` / `setX()` / `expectY()`）。
3. 在 `e2e/specs/` 寫一支短 spec，`import { test, expect } from '../fixtures/test'`，用 POM 安排→操作→斷言。

## 範圍與後續

- 第一版只做**離線功能互動**：導覽、外觀（字級／高對比）、主題、語言、命令面板、特色導覽、對話清單。
- 後續（第二階段）：
  - `@live` 測試（聊天串流、產生範例…需本機 Ollama/MCP）——標記 `@live`、放 `specs/live/`、用 `npm run test:live`。
  - 視覺回歸截圖（`toHaveScreenshot`）——建議以 CI 單一 OS 產基準圖、opt-in。
  - GitHub Actions（ubuntu + xvfb 跑離線套件）。
