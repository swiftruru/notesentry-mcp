import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, isAbsolute } from 'node:path'
import { AppConfig, DEFAULT_CONFIG } from '@shared/types'

// 設定檔一律寫在「專案資料夾內」（符合 DUA：資料不離開本機/專案）。
// 開發時 cwd 即專案根；打包後以執行檔旁的目錄為基準。
const PROJECT_ROOT = process.cwd()
const CONFIG_PATH = resolve(PROJECT_ROOT, 'config.json')

let cache: AppConfig | null = null

/** 把設定中的相對路徑換算成相對於專案根的絕對路徑（供子行程/DB 使用） */
export function resolveProjectPath(p: string): string {
  if (!p) return p
  return isAbsolute(p) ? p : resolve(PROJECT_ROOT, p)
}

export function getProjectRoot(): string {
  return PROJECT_ROOT
}

/** 正規化（含舊版單一 mcpScriptPath → mcpServers 陣列的遷移） */
function normalize(raw: Record<string, unknown>): AppConfig {
  const merged = { ...DEFAULT_CONFIG, ...raw } as AppConfig & {
    mcpScriptPath?: string
  }
  // 舊版只有單一 mcpScriptPath、沒有 mcpServers → 用它組出第一支 server。
  if (!Array.isArray(merged.mcpServers) || merged.mcpServers.length === 0) {
    const legacy = merged.mcpScriptPath
    merged.mcpServers = legacy
      ? [
          { id: 'mimic', name: 'MIMIC 病歷查詢', scriptPath: legacy, enabled: true },
          ...DEFAULT_CONFIG.mcpServers.filter((s) => s.id !== 'mimic')
        ]
      : DEFAULT_CONFIG.mcpServers.map((s) => ({ ...s }))
  }
  delete merged.mcpScriptPath
  return {
    ollamaUrl: merged.ollamaUrl,
    model: merged.model,
    pythonPath: merged.pythonPath,
    dbPath: merged.dbPath,
    mcpServers: merged.mcpServers,
    language: merged.language ?? DEFAULT_CONFIG.language,
    // 保留「上次匯出資料夾」偏好（undefined 會被 JSON.stringify 自動略過）。
    lastExportDir: merged.lastExportDir
  }
}

export function loadConfig(): AppConfig {
  if (cache) return cache
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
      cache = normalize(raw)
    } catch (err) {
      console.error('[config] 讀取 config.json 失敗，改用預設值：', err)
      cache = { ...DEFAULT_CONFIG }
    }
  } else {
    cache = { ...DEFAULT_CONFIG }
    saveConfig(cache)
  }
  return cache ?? { ...DEFAULT_CONFIG }
}

export function saveConfig(config: AppConfig): AppConfig {
  cache = normalize(config as unknown as Record<string, unknown>)
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(cache, null, 2), 'utf-8')
  } catch (err) {
    console.error('[config] 寫入 config.json 失敗：', err)
  }
  return cache
}

/**
 * 守門：Ollama 必須是本機位址。回傳是否安全 + 提示訊息。
 * 這是硬性限制——資料不可送往任何第三方，推論一律走本機。
 */
// 回傳「翻譯鍵 + 變數」而非成品字串，由呼叫端用 tMain 翻譯（避免與 i18n 形成循環相依）。
export function isLocalOllama(
  url: string
): { ok: boolean; reasonKey?: string; vars?: Record<string, string> } {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    const localHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0']
    if (localHosts.includes(host)) return { ok: true }
    return { ok: false, reasonKey: 'main.error.ollamaNotLocal', vars: { host } }
  } catch {
    return { ok: false, reasonKey: 'main.error.ollamaUrlInvalid' }
  }
}
