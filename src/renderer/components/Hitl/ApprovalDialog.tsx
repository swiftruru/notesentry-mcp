import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { ShieldAlert, Check, X } from 'lucide-react'

/**
 * 人類覆核確認框：模型要求呼叫工具時跳出，清楚列出工具名與參數。
 * 使用者必須親自同意才會實際呼叫工具——這是不可略過的安全閘門。
 *
 * 鍵盤：Enter 核可、Esc 拒絕；開啟時焦點移到「核可」鈕、Tab 鎖在框內、關閉後還原焦點。
 */
export function ApprovalDialog(): React.JSX.Element | null {
  const { t } = useTranslation('hitl')
  const pending = useAppStore((s) => s.pendingHitl)
  const respond = useAppStore((s) => s.respondHitl)

  const dialogRef = useRef<HTMLDivElement>(null)
  const approveRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!pending) return
    const prevFocus = document.activeElement as HTMLElement | null
    approveRef.current?.focus()

    const focusables = (): HTMLElement[] =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => !el.hasAttribute('disabled'))

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        void respond(false)
      } else if (e.key === 'Enter') {
        // 焦點在按鈕上時讓按鈕自己處理（避免重複觸發）；否則 Enter 預設為核可。
        const tag = (e.target as HTMLElement)?.tagName
        if (tag !== 'BUTTON') {
          e.preventDefault()
          void respond(true)
        }
      } else if (e.key === 'Tab') {
        // 簡易焦點鎖定：Tab 在框內循環。
        const items = focusables()
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement as HTMLElement
        if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      prevFocus?.focus?.()
    }
  }, [pending, respond])

  if (!pending) return null

  const argEntries = Object.entries(pending.args ?? {})

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm">
      <div
        ref={dialogRef}
        data-testid="hitl-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="hitl-title"
        className="w-full max-w-lg animate-fade-in rounded-xl border border-border bg-surface shadow-xl"
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-accent/20 text-brand">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 id="hitl-title" className="text-base font-semibold text-ink">
              {t('title')}
            </h3>
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
                {argEntries.map(([k, v], i) => {
                  const complex = v !== null && typeof v === 'object'
                  return (
                    <div
                      key={k}
                      className={`flex gap-3 px-3 py-2 text-sm ${
                        i % 2 === 0 ? 'bg-card/50' : 'bg-surface'
                      }`}
                    >
                      <span className="min-w-24 shrink-0 font-mono text-xs text-ink-muted">{k}</span>
                      {complex ? (
                        <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-ink">
                          {JSON.stringify(v, null, 2)}
                        </pre>
                      ) : (
                        <span className="break-all font-mono text-xs text-ink">{String(v)}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-4">
          <span className="text-[11px] text-ink-muted">{t('kbdHint')}</span>
          <div className="flex gap-2">
            <Button data-testid="hitl-reject" variant="outline" onClick={() => respond(false)}>
              <X className="h-4 w-4" />
              {t('reject')}
            </Button>
            <Button data-testid="hitl-approve" ref={approveRef} onClick={() => respond(true)}>
              <Check className="h-4 w-4" />
              {t('approve')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
