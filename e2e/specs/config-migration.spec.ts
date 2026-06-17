import { test, expect } from '@playwright/test'
import { launchApp, closeApp } from '../fixtures/electronApp'

interface SeededServer {
  id: string
  name: string
  scriptPath: string
  enabled: boolean
}

/**
 * 升級遷移：舊版 config.json 仍指向專案根的舊路徑（./mimic_mcp_server.py）。
 * configStore.normalize 應把「內建 server」的 scriptPath 對齊目前 DEFAULT_CONFIG（搬到 mcp/servers/），
 * 並保留使用者的啟用狀態、補回缺少的預設 server。
 */
test.describe('Config migration (offline)', () => {
  test('legacy built-in scriptPaths are migrated to mcp/servers and missing defaults re-added', async () => {
    const handle = await launchApp({
      seedConfig: {
        mcpServers: [{ id: 'mimic', name: 'old name', scriptPath: './mimic_mcp_server.py', enabled: false }]
      }
    })
    try {
      const cfg = await handle.page.evaluate(
        () => (window as unknown as { api: { getConfig: () => Promise<unknown> } }).api.getConfig()
      )
      const servers = (cfg as { mcpServers: SeededServer[] }).mcpServers
      const mimic = servers.find((s) => s.id === 'mimic')!

      // 內建 server 的腳本路徑改寫到新位置；使用者的 enabled=false 保留。
      expect(mimic.scriptPath).toBe('./mcp/servers/mimic_mcp_server.py')
      expect(mimic.enabled).toBe(false)
      // 缺少的預設 server（clinical/nis/pharmacy）被補回。
      expect(servers.map((s) => s.id).sort()).toEqual(['clinical', 'mimic', 'nis', 'pharmacy'])
    } finally {
      await closeApp(handle)
    }
  })
})
