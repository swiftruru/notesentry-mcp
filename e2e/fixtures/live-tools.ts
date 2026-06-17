import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { test as base, expect } from '@playwright/test'
import { launchApp, closeApp, type AppHandle } from './electronApp'
import { AppShell } from '../pages/AppShell'
import { DEFAULT_CONFIG } from '../../src/shared/types'

const OLLAMA_URL = 'http://localhost:11434'
const DB_PATH = resolve(__dirname, '../../mimic_notes.db')

async function detectModel(): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`)
    if (!res.ok) return null
    const data = (await res.json()) as { models?: { name?: string; model?: string }[] }
    const names = (data.models ?? []).map((m) => m.name ?? m.model).filter((n): n is string => !!n)
    if (!names.length) return null
    return names.includes(DEFAULT_CONFIG.model) ? DEFAULT_CONFIG.model : names[0]
  } catch {
    return null
  }
}

interface LiveToolsWorkerFixtures {
  liveReady: { model: string } | null
  liveApp: AppHandle | null
}
interface LiveToolsTestFixtures {
  shell: AppShell
  exportDir: string
}

/**
 * @live-tools：真模型 + 真 MCP + 真 DB 的工具核可全流程。
 * 需 Ollama 有模型「且」專案根 mimic_notes.db 存在；缺一即整批 skip。
 * 種入設定：啟用預設 MCP，dbPath 用專案根 DB 的**絕對路徑**（否則會被解析到暫存 NS_DATA_DIR 而找不到）。
 */
export const test = base.extend<LiveToolsTestFixtures, LiveToolsWorkerFixtures>({
  liveReady: [
    async ({}, use) => {
      const model = await detectModel()
      await use(model && existsSync(DB_PATH) ? { model } : null)
    },
    { scope: 'worker' }
  ],

  liveApp: [
    async ({ liveReady }, use) => {
      if (!liveReady) {
        await use(null)
        return
      }
      const seedConfig = {
        ...DEFAULT_CONFIG,
        model: liveReady.model,
        dbPath: DB_PATH,
        mcpServers: DEFAULT_CONFIG.mcpServers.map((s) => ({ ...s }))
      }
      const handle = await launchApp({ seedConfig })
      await use(handle)
      await closeApp(handle)
    },
    { scope: 'worker' }
  ],

  shell: async ({ liveApp }, use) => {
    const shell = new AppShell(liveApp!.page)
    await shell.ready()
    await use(shell)
  },

  exportDir: async ({ liveApp }, use) => use(liveApp!.exportDir)
})

test.beforeEach(({ liveReady }) => {
  test.skip(!liveReady, 'Ollama 模型或 mimic_notes.db 不可用，跳過 @live-tools')
})

export { expect }
