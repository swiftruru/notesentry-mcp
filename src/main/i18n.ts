import { loadConfig } from './config/configStore'

// 主行程的輕量 i18n：載入 main / prompt 兩個 namespace（新增語言目錄即自動收錄）。
const modules = import.meta.glob(
  ['../shared/locales/*/main.json', '../shared/locales/*/prompt.json'],
  { eager: true }
)

const dict: Record<string, Record<string, unknown>> = {}
for (const path in modules) {
  const m = path.match(/locales\/([^/]+)\/([^/]+)\.json$/)
  if (!m) continue
  const [, lng, ns] = m
  dict[lng] ??= {}
  dict[lng][ns] = (modules[path] as { default?: unknown }).default ?? modules[path]
}

const FALLBACK = 'zh-TW'

export function currentLanguage(): string {
  return loadConfig().language || FALLBACK
}

function lookup(lng: string, dottedKey: string): unknown {
  const [ns, ...rest] = dottedKey.split('.')
  let cur: unknown = dict[lng]?.[ns]
  for (const k of rest) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

/**
 * 主行程翻譯：key 形如 'main.export.user' 或 'prompt.system'。
 * 語言取自 config.language（fallback zh-TW），並做簡單 {{var}} 插值。
 */
export function tMain(key: string, vars?: Record<string, string | number>): string {
  const lng = currentLanguage()
  let val = lookup(lng, key)
  if (typeof val !== 'string') val = lookup(FALLBACK, key)
  if (typeof val !== 'string') return key
  return val.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    vars && name in vars ? String(vars[name]) : `{{${name}}}`
  )
}
