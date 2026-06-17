import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { healthRows, RowLevel } from '@/lib/health'
import { cn } from '@/lib/utils'
import { Check, X, AlertTriangle, Minus, RefreshCw, Settings, Circle } from 'lucide-react'

const dotByLevel: Record<string, string> = {
  ok: 'text-emerald-500',
  warn: 'text-amber-500',
  error: 'text-red-500',
  unknown: 'text-ink-muted'
}

function RowIcon({ level }: { level: RowLevel }): React.JSX.Element {
  if (level === 'ok') return <Check className="h-3.5 w-3.5 text-emerald-600" />
  if (level === 'warn') return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
  if (level === 'error') return <X className="h-3.5 w-3.5 text-red-600" />
  return <Minus className="h-3.5 w-3.5 text-ink-muted" />
}

/** 標題列常駐的系統健康狀態：圓點 + 文字，點擊展開逐項診斷與快速動作。 */
export function HealthStatus(): React.JSX.Element {
  const { t } = useTranslation('health')
  const health = useAppStore((s) => s.health)
  const model = useAppStore((s) => s.config?.model ?? '')
  const refreshHealth = useAppStore((s) => s.refreshHealth)
  const setView = useAppStore((s) => s.setView)
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 點外面就關閉。
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const recheck = async (): Promise<void> => {
    setChecking(true)
    try {
      await refreshHealth()
    } finally {
      setChecking(false)
    }
  }

  const rows = healthRows(health, model, t)
  const levelLabel = t(`level.${health.level}`)

  return (
    <div ref={ref} data-testid="health-status" className="no-drag relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`${t('title')}: ${levelLabel}`}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-card/70"
      >
        <Circle className={cn('h-2.5 w-2.5 fill-current', dotByLevel[health.level])} />
        {levelLabel}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('title')}
          className="absolute right-0 top-full z-50 mt-2 w-80 animate-fade-in rounded-xl border border-border bg-surface p-2 shadow-xl"
        >
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t('title')}
            </span>
          </div>

          <ul className="space-y-0.5">
            {rows.map((r) => (
              <li key={r.key} className="flex items-start gap-2 rounded-md px-2 py-1.5">
                <span className="mt-0.5 shrink-0">
                  <RowIcon level={r.level} />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-ink">{r.label}</div>
                  <div className="text-[11px] leading-snug text-ink-muted">{r.detail}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border px-1 pt-2">
            <button
              onClick={recheck}
              disabled={checking}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-muted transition-colors hover:text-brand disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', checking && 'animate-spin')} />
              {checking ? t('checking') : t('recheck')}
            </button>
            <button
              onClick={() => {
                setView('settings')
                setOpen(false)
              }}
              className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-secondary"
            >
              <Settings className="h-3.5 w-3.5" />
              {t('openSettings')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
