import type { TFunction } from 'i18next'
import type { HealthState } from '@/store/useAppStore'

export type RowLevel = 'ok' | 'warn' | 'error' | 'muted'

export interface HealthRow {
  key: 'ollama' | 'model' | 'mcp' | 'db' | 'python'
  label: string
  level: RowLevel
  detail: string
}

/**
 * 把健康狀態攤平成逐項列（給狀態列 popover 用）。
 * `t` 必須綁定 'health' namespace；`model` 為目前設定的模型名。
 */
export function healthRows(h: HealthState, model: string, t: TFunction): HealthRow[] {
  const { ollama, db, python, mcp } = h

  const ollamaRow: HealthRow = {
    key: 'ollama',
    label: t('items.ollama'),
    level: ollama.ok ? 'ok' : 'error',
    // 失敗一律顯示乾淨可行動的提示（原始 fetch 錯誤對使用者無意義）。
    detail: ollama.ok ? t('ollamaOk', { count: ollama.models.length }) : t('ollamaFailShort')
  }

  const modelRow: HealthRow = {
    key: 'model',
    label: t('items.model'),
    level: !ollama.ok ? 'muted' : ollama.modelPresent ? 'ok' : 'warn',
    detail: !ollama.ok
      ? t('modelUnknown')
      : ollama.modelPresent
        ? t('modelOk', { model })
        : t('modelMissing', { model })
  }

  const mcpRow: HealthRow = {
    key: 'mcp',
    label: t('items.mcp'),
    level: mcp.total === 0 || mcp.connected === 0 ? 'error' : mcp.connected < mcp.total ? 'warn' : 'ok',
    detail:
      mcp.total === 0 || mcp.connected === 0
        ? t('mcpNone')
        : t('mcpStatus', { connected: mcp.connected, total: mcp.total, count: mcp.total })
  }

  const dbRow: HealthRow = {
    key: 'db',
    label: t('items.db'),
    level: db.exists ? 'ok' : 'warn',
    detail: db.exists ? t('dbOk') : t('dbMissing', { path: db.path })
  }

  const pythonRow: HealthRow = {
    key: 'python',
    label: t('items.python'),
    level: python.ok ? 'ok' : 'warn',
    detail: python.ok ? t('pythonOk', { info: python.info }) : t('pythonFail', { info: python.info })
  }

  return [ollamaRow, modelRow, mcpRow, dbRow, pythonRow]
}

/** 最該優先處理的問題（依嚴重度排序）；無問題時回傳 null。供啟動橫幅用。 */
export function primaryProblem(h: HealthState, model: string, t: TFunction): string | null {
  if (h.level === 'ok' || h.level === 'unknown') return null
  const rows = healthRows(h, model, t)
  const order: HealthRow['key'][] = ['ollama', 'mcp', 'db', 'python', 'model']
  const byKey = (k: HealthRow['key']): HealthRow | undefined => rows.find((r) => r.key === k)
  for (const k of order) {
    const r = byKey(k)
    if (r && r.level === 'error') return r.detail
  }
  for (const k of order) {
    const r = byKey(k)
    if (r && r.level === 'warn') return r.detail
  }
  return null
}
