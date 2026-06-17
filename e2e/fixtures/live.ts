import { test as base, expect } from '@playwright/test'
import { launchApp, closeApp, type AppHandle } from './electronApp'
import { AppShell } from '../pages/AppShell'
import { DEFAULT_CONFIG } from '../../src/shared/types'

const OLLAMA_URL = 'http://localhost:11434'

/** 偵測本機 Ollama 是否可用並挑一個模型；不可達或無模型 → null（整批 @live 會自動跳過）。 */
async function detectModel(): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`)
    if (!res.ok) return null
    const data = (await res.json()) as { models?: { name?: string; model?: string }[] }
    const names = (data.models ?? [])
      .map((m) => m.name ?? m.model)
      .filter((n): n is string => !!n)
    if (!names.length) return null
    // 優先用預設模型，否則用清單第一個。
    return names.includes(DEFAULT_CONFIG.model) ? DEFAULT_CONFIG.model : names[0]
  } catch {
    return null
  }
}

interface LiveWorkerFixtures {
  liveModel: string | null
  liveApp: AppHandle | null
}
interface LiveTestFixtures {
  shell: AppShell
}

/**
 * @live 測試專用 test：
 * - 偵測 Ollama／模型（worker 一次）；沒有就整批 skip。
 * - 啟動時種入「停用所有 MCP」的設定 → 不提供工具 → 模型只會直接回答、不觸發 HITL，純 Ollama 即可跑。
 */
export const test = base.extend<LiveTestFixtures, LiveWorkerFixtures>({
  liveModel: [async ({}, use) => use(await detectModel()), { scope: 'worker' }],

  liveApp: [
    async ({ liveModel }, use) => {
      if (!liveModel) {
        await use(null)
        return
      }
      // normalize() 會強制補回所有預設 MCP server，故「停用」要逐一列出預設 id（enabled:false）。
      const seedConfig = {
        ...DEFAULT_CONFIG,
        model: liveModel,
        mcpServers: DEFAULT_CONFIG.mcpServers.map((s) => ({ ...s, enabled: false }))
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
    await shell.resetToDashboard()
  }
})

// 沒有可用模型 → 整批 @live 跳過（不 fail）。只相依 liveModel，故跳過時不會啟動 app。
test.beforeEach(({ liveModel }) => {
  test.skip(!liveModel, 'Ollama/模型不可用，跳過 @live')
})

export { expect }
