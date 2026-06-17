import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { AppConfig, DEFAULT_CONFIG } from '@shared/types'
import { getDataRoot, resolveDataPath } from '../paths'

// 設定檔寫在「資料根」內（開發＝專案根、打包＝userData）；皆在本機、符合 DUA。
function configPath(): string {
  return resolve(getDataRoot(), 'config.json')
}

let cache: AppConfig | null = null

/** 把設定中的相對 DB/資料路徑換算成相對於資料根的絕對路徑（供子行程/DB 使用） */
export function resolveProjectPath(p: string): string {
  return resolveDataPath(p)
}

export function getProjectRoot(): string {
  return getDataRoot()
}

/** 數值夾在 [min,max]；非有限數則回 fallback。 */
function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
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
          { id: 'mimic', name: 'MIMIC 病歷查詢（HIS）', scriptPath: legacy, enabled: true },
          ...DEFAULT_CONFIG.mcpServers.filter((s) => s.id !== 'mimic')
        ]
      : DEFAULT_CONFIG.mcpServers.map((s) => ({ ...s }))
  }
  // 內建 server 的腳本路徑由 app 管理：一律對齊目前 DEFAULT_CONFIG（讓檔案搬移／版本更新自動生效，
  // 例如舊設定仍指向專案根 ./mimic_mcp_server.py → 改寫為 ./mcp/servers/...），保留使用者的啟用狀態與名稱。
  // 使用者若改用標準 command 啟動（command 有值）則尊重其設定、不覆寫。
  const defById = new Map(DEFAULT_CONFIG.mcpServers.map((s) => [s.id, s]))
  merged.mcpServers = merged.mcpServers.map((s) => {
    const def = defById.get(s.id)
    return def && !s.command ? { ...s, scriptPath: def.scriptPath } : s
  })
  // 自動補進「設定中還缺少」的預設 server（例如版本更新後新增的 nis / pharmacy）。
  const existing = new Set(merged.mcpServers.map((s) => s.id))
  for (const def of DEFAULT_CONFIG.mcpServers) {
    if (!existing.has(def.id)) merged.mcpServers.push({ ...def })
  }
  delete merged.mcpScriptPath
  return {
    ollamaUrl: merged.ollamaUrl,
    model: merged.model,
    pythonPath: merged.pythonPath,
    dbPath: merged.dbPath,
    mcpServers: merged.mcpServers,
    temperature: clampNum(merged.temperature, 0, 1, DEFAULT_CONFIG.temperature as number),
    maxTurns: Math.round(clampNum(merged.maxTurns, 1, 20, DEFAULT_CONFIG.maxTurns as number)),
    language: merged.language ?? DEFAULT_CONFIG.language,
    theme: merged.theme ?? DEFAULT_CONFIG.theme,
    fontScale: (['sm', 'md', 'lg', 'xl'] as const).includes(merged.fontScale as 'md')
      ? merged.fontScale
      : DEFAULT_CONFIG.fontScale,
    highContrast: typeof merged.highContrast === 'boolean' ? merged.highContrast : false,
    // 保留「上次匯出資料夾」與「上次視窗幾何」偏好（undefined 會被 JSON.stringify 自動略過）。
    lastExportDir: merged.lastExportDir,
    windowBounds: merged.windowBounds
  }
}

export function loadConfig(): AppConfig {
  if (cache) return cache
  const path = configPath()
  if (existsSync(path)) {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8'))
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
    writeFileSync(configPath(), JSON.stringify(cache, null, 2), 'utf-8')
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
