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
  retries: 0,
  // app 啟動偏慢，給寬鬆一點的單測逾時。
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    // 預設：離線功能互動測試（排除 @live）。
    { name: 'offline', grepInvert: /@live/ },
    // 保留：需本機 Ollama/MCP 的流程（第二階段）。
    { name: 'live', grep: /@live/ }
  ]
})
