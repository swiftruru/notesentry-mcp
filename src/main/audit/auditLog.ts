import { appendFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { AuditEntry } from '@shared/types'
import { getDataRoot } from '../paths'

// 稽核日誌寫在資料根 ./logs 下（開發＝專案根、打包＝userData），每天一個 JSONL 檔。
function logDir(): string {
  return resolve(getDataRoot(), 'logs')
}

function ensureDir(): void {
  const dir = logDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function fileForTs(ts: number): string {
  const d = new Date(ts)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return join(logDir(), `audit-${yyyy}-${mm}-${dd}.jsonl`)
}

// 記憶體環形緩衝，供 UI 快速取用（落地仍以 JSONL 為準）。
const RING_MAX = 500
const ring: AuditEntry[] = []

type AuditListener = (entry: AuditEntry) => void
const listeners = new Set<AuditListener>()

export function onAudit(cb: AuditListener): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** 記錄一筆稽核：同時落地 JSONL、推進環形緩衝、通知監聽者。 */
export function recordAudit(entry: AuditEntry): void {
  ring.push(entry)
  if (ring.length > RING_MAX) ring.shift()
  try {
    ensureDir()
    appendFileSync(fileForTs(entry.ts), JSON.stringify(entry) + '\n', 'utf-8')
  } catch (err) {
    console.error('[audit] 寫入稽核日誌失敗：', err)
  }
  for (const cb of listeners) {
    try {
      cb(entry)
    } catch {
      /* 忽略單一監聽者錯誤 */
    }
  }
}

/** 取得最近的稽核紀錄：優先用記憶體緩衝，啟動時則從當日檔案回補。 */
export function listAudit(): AuditEntry[] {
  if (ring.length > 0) return [...ring]
  try {
    ensureDir()
    const dir = logDir()
    const files = readdirSync(dir)
      .filter((f) => f.startsWith('audit-') && f.endsWith('.jsonl'))
      .sort()
    const entries: AuditEntry[] = []
    // 只回補最近兩個檔，避免啟動時讀過多。
    for (const f of files.slice(-2)) {
      const lines = readFileSync(join(dir, f), 'utf-8').split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          entries.push(JSON.parse(line))
        } catch {
          /* 跳過壞行 */
        }
      }
    }
    return entries.slice(-RING_MAX)
  } catch {
    return []
  }
}
