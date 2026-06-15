import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// 自動載入 src/shared/locales 下的所有翻譯檔（新增語言目錄即自動收錄，不需改程式）。
const modules = import.meta.glob('../../shared/locales/**/*.json', { eager: true })

type Dict = Record<string, unknown>
const resources: Record<string, Dict> = {}
for (const path in modules) {
  const m = path.match(/locales\/([^/]+)\/([^/]+)\.json$/)
  if (!m) continue
  const [, lng, ns] = m
  resources[lng] ??= {}
  ;(resources[lng] as Record<string, unknown>)[ns] =
    (modules[path] as { default?: unknown }).default ?? modules[path]
}

/** 可用語言（= locales 下的資料夾名）。 */
export const SUPPORTED = Object.keys(resources).sort()

/** 各語言的顯示名稱與短碼（從各自 common.language 讀取）。 */
export const languageMeta: Record<string, { self: string; short: string }> = {}
for (const lng of SUPPORTED) {
  const common = (resources[lng] as Record<string, { language?: { self?: string; short?: string } }>)
    .common
  languageMeta[lng] = {
    self: common?.language?.self ?? lng,
    short: common?.language?.short ?? lng.toUpperCase()
  }
}

const namespaces = Array.from(
  new Set(Object.values(resources).flatMap((d) => Object.keys(d as object)))
)

const FALLBACK = 'zh-TW'

/** locale 代碼 → BCP47 語言標籤（給螢幕報讀器用的 <html lang>）。 */
const BCP47: Record<string, string> = { 'zh-TW': 'zh-Hant', en: 'en' }

/** 同步 document.documentElement.lang，讓報讀器以正確語言朗讀。 */
export function applyHtmlLang(lng: string): void {
  if (typeof document !== 'undefined') document.documentElement.lang = BCP47[lng] ?? lng
}

export async function initI18n(language?: string): Promise<typeof i18n> {
  await i18n.use(initReactI18next).init({
    resources: resources as never,
    lng: language && SUPPORTED.includes(language) ? language : FALLBACK,
    fallbackLng: FALLBACK,
    ns: namespaces,
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    returnNull: false
  })
  return i18n
}

export default i18n
