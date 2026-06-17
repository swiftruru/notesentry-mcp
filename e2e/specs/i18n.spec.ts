import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect } from '@playwright/test'

/**
 * i18n 翻譯完整性：不啟動 app，純讀 src/shared/locales 比對各語系。
 * 防止雙語（zh-TW / en）翻譯漂移——namespace 缺檔、漏鍵、或鍵在但沒填字。
 * 泛用於所有語系資料夾（對齊 i18n/index.ts 以資料夾自動探索的作法）。
 */
const LOCALES_DIR = resolve(__dirname, '../../src/shared/locales')
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

const LANGS = readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()

/** 該語系的 namespace 檔名集合（不含副檔名）。 */
function namespacesOf(lang: string): string[] {
  return readdirSync(resolve(LOCALES_DIR, lang))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort()
}

function loadJson(lang: string, ns: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(LOCALES_DIR, lang, `${ns}.json`), 'utf-8'))
}

/** 巢狀 JSON → dot-path leaf 清單（值與路徑）。 */
function flatten(obj: unknown, prefix = '', out: Array<{ key: string; value: unknown }> = []): Array<{ key: string; value: unknown }> {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out)
    }
  } else {
    out.push({ key: prefix, value: obj })
  }
  return out
}

/** 去掉 leaf 段尾的 i18next 複數後綴（zh 只有 _other、en 有 _one+_other 屬正常）。 */
function stripPlural(key: string): string {
  const parts = key.split('.')
  parts[parts.length - 1] = parts[parts.length - 1].replace(PLURAL_SUFFIX, '')
  return parts.join('.')
}

function baseKeys(lang: string, ns: string): Set<string> {
  return new Set(flatten(loadJson(lang, ns)).map((e) => stripPlural(e.key)))
}

test.describe('i18n completeness', () => {
  test('all locales expose the same namespaces', () => {
    expect(LANGS.length, 'expected at least 2 locales').toBeGreaterThanOrEqual(2)
    const ref = namespacesOf(LANGS[0])
    for (const lang of LANGS.slice(1)) {
      expect(namespacesOf(lang), `namespace set differs in "${lang}"`).toEqual(ref)
    }
  })

  // 以第一個語系的 namespace 清單為基準，逐一比對 base-key。
  for (const ns of namespacesOf(LANGS[0])) {
    test(`namespace "${ns}" has matching keys across locales`, () => {
      const ref = baseKeys(LANGS[0], ns)
      for (const lang of LANGS.slice(1)) {
        const cur = baseKeys(lang, ns)
        const missingInCur = [...ref].filter((k) => !cur.has(k))
        const extraInCur = [...cur].filter((k) => !ref.has(k))
        expect(
          { missingInCur, extraInCur },
          `"${ns}" key mismatch between "${LANGS[0]}" and "${lang}"`
        ).toEqual({ missingInCur: [], extraInCur: [] })
      }
    })
  }

  test('no empty-string translations in any locale', () => {
    const empties: string[] = []
    for (const lang of LANGS) {
      for (const ns of namespacesOf(lang)) {
        for (const { key, value } of flatten(loadJson(lang, ns))) {
          if (typeof value === 'string' && value.trim() === '') empties.push(`${lang}/${ns}: ${key}`)
        }
      }
    }
    expect(empties, 'empty translation values found').toEqual([])
  })
})
