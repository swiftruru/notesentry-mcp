import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { ShieldAlert, Check, X } from 'lucide-react'

/**
 * 人類覆核確認框：模型要求呼叫工具時跳出，清楚列出工具名與參數。
 * 使用者必須親自同意才會實際呼叫工具——這是不可略過的安全閘門。
 */
export function ApprovalDialog(): React.JSX.Element | null {
  const { t } = useTranslation('hitl')
  const pending = useAppStore((s) => s.pendingHitl)
  const respond = useAppStore((s) => s.respondHitl)

  if (!pending) return null

  const argEntries = Object.entries(pending.args ?? {})

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm">
      <div className="w-full max-w-lg animate-fade-in rounded-xl border border-border bg-white shadow-xl">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-accent/20 text-brand">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink">{t('title')}</h3>
            <p className="text-xs text-ink-muted">{t('subtitle')}</p>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                {t('toolLabel')}
              </div>
              {pending.serverName && (
                <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-brand">
                  {t('source', { server: pending.serverName })}
                </span>
              )}
            </div>
            <div className="mt-1 font-mono text-sm font-semibold text-brand">
              {pending.toolName}
            </div>
            {pending.description && (
              <p className="mt-1 text-xs text-ink-muted">{pending.description}</p>
            )}
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {t('paramsLabel')}
            </div>
            {argEntries.length === 0 ? (
              <div className="mt-1 text-sm text-ink-muted">{t('noParams')}</div>
            ) : (
              <div className="mt-1 overflow-hidden rounded-md border border-border">
                {argEntries.map(([k, v], i) => (
                  <div
                    key={k}
                    className={`flex gap-3 px-3 py-2 text-sm ${
                      i % 2 === 0 ? 'bg-card/50' : 'bg-white'
                    }`}
                  >
                    <span className="min-w-24 font-mono text-xs text-ink-muted">
                      {k}
                    </span>
                    <span className="break-all font-mono text-xs text-ink">
                      {typeof v === 'string' ? v : JSON.stringify(v)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" onClick={() => respond(false)}>
            <X className="h-4 w-4" />
            {t('reject')}
          </Button>
          <Button onClick={() => respond(true)}>
            <Check className="h-4 w-4" />
            {t('approve')}
          </Button>
        </div>
      </div>
    </div>
  )
}
