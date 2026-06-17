import { test as base, expect } from '@playwright/test'
import { launchApp, closeApp, type AppHandle } from './electronApp'
import { AppShell } from '../pages/AppShell'
import { DEFAULT_CONFIG } from '../../src/shared/types'

/**
 * a11y 專用啟動：種入「不可達的本機 Ollama + 停用 MCP」，讓健康/警告狀態（amber「未偵測到模型」、
 * 紅色錯誤文字等）**確定性渲染** —— 與 CI 離線環境一致，避免「開發者本機有 Ollama → 漏掃警告態」的分歧。
 * ollamaUrl 用 127.0.0.1:9（本機、過 isLocalOllama 守門，但無人服務 → 連線即失敗）。
 */
const SEED_CONFIG = {
  ...DEFAULT_CONFIG,
  ollamaUrl: 'http://127.0.0.1:9',
  mcpServers: DEFAULT_CONFIG.mcpServers.map((s) => ({ ...s, enabled: false }))
}

export const test = base.extend<{ shell: AppShell }, { a11yApp: AppHandle }>({
  a11yApp: [
    async ({}, use) => {
      const handle = await launchApp({ seedConfig: SEED_CONFIG })
      await use(handle)
      await closeApp(handle)
    },
    { scope: 'worker' }
  ],

  shell: async ({ a11yApp }, use) => {
    const shell = new AppShell(a11yApp.page)
    await shell.ready()
    await use(shell)
    await shell.resetToDashboard()
  }
})

export { expect }
