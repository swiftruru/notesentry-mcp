import { defineConfig } from '@playwright/test'

/**
 * NoteSentry 全自動 UI 測試（Playwright + Electron）。
 *
 * - 直接啟動「打包後的 out/ 真實 app」並驅動 renderer（見 e2e/fixtures/electronApp.ts）。
 * - 預設只跑 `offline` 專案：完全不需 Ollama／MCP；`@live` 標記的測試另開 `live` 專案、第二階段啟用。
 * - 跑前請先 `npm run build`（npm 的 pretest 已自動處理）。
 */
export default defineConfig({
  testDir: './e2e/specs',
  // Electron app 測試以序列執行最穩定：多個 Electron 視窗並行時，背景視窗的
  // 真實 hover/focus 會不穩（例如 hover 才顯示的操作鈕）。故固定單一 worker。
  fullyParallel: false,
  workers: 1,
  // CI 失敗重試一次並留 trace，方便排查偶發；本機不重試。
  retries: process.env.CI ? 1 : 0,
  // app 啟動偏慢，給寬鬆一點的單測逾時。
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'on-first-retry' },
  projects: [
    // 預設：離線功能互動測試（排除 @live、@visual、@capture）。
    { name: 'offline', grepInvert: /@live|@visual|@capture/ },
    // 需本機 Ollama 的純問答流程（偵測不到模型會自動跳過）；排除 @live-tools。
    { name: 'live', grep: /@live/, grepInvert: /@live-tools/, timeout: 120_000 },
    // @live-tools：真模型觸發工具→核可→稽核（需 DB+MCP，最易 flaky）；逾時最寬。
    { name: 'live-tools', grep: /@live-tools/, timeout: 180_000 },
    // 視覺回歸截圖（本機 opt-in、不擋 CI）。
    { name: 'visual', grep: /@visual/ },
    // 文件用截圖擷取（本機 opt-in，需 Ollama+MCP+DB）；產出 docs/screenshots-1/。
    { name: 'capture', grep: /@capture/, timeout: 600_000, testDir: './e2e/capture' }
  ]
})
