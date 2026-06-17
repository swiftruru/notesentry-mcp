import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { Badge, Input } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { formatTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Check,
  X,
  ScrollText,
  FileWarning,
  Search,
  Download,
  FileBarChart2,
  ChevronRight,
  ChevronDown,
  AlertTriangle
} from 'lucide-react'

type Filter = 'all' | 'approved' | 'rejected' | 'error'

export function AuditView(): React.JSX.Element {
  const { t } = useTranslation('audit')
  const audit = useAppStore((s) => s.audit)
  const exportAudit = useAppStore((s) => s.exportAudit)
  const exportGovernanceReport = useAppStore((s) => s.exportGovernanceReport)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // 帶上穩定 key 並反轉（新的在上）。
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return audit
      .map((e, i) => ({ e, key: `${e.ts}-${i}` }))
      .filter(({ e }) => {
        if (filter === 'approved' && !e.approved) return false
        if (filter === 'rejected' && e.approved) return false
        if (filter === 'error' && !e.error) return false
        if (!q) return true
        return (
          e.toolName.toLowerCase().includes(q) ||
          JSON.stringify(e.args).toLowerCase().includes(q) ||
          (e.error ?? '').toLowerCase().includes(q)
        )
      })
      .reverse()
  }, [audit, query, filter])

  const toggle = (key: string): void =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const FILTERS: Filter[] = ['all', 'approved', 'rejected', 'error']

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border px-6 py-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ScrollText className="h-4 w-4 text-brand" />
            {t('title')}
            <span className="text-xs font-normal text-ink-muted">{t('count', { count: rows.length })}</span>
          </h1>
          <div className="flex items-center gap-1">
            <Button
              data-testid="audit-report"
              variant="ghost"
              size="sm"
              onClick={() => void exportGovernanceReport()}
              title={t('reportTooltip')}
            >
              <FileBarChart2 className="h-3.5 w-3.5" />
              {t('report')}
            </Button>
            <Button
              data-testid="audit-export"
              variant="ghost"
              size="sm"
              onClick={() => void exportAudit()}
              disabled={audit.length === 0}
              title={t('export')}
            >
              <Download className="h-3.5 w-3.5" />
              {t('export')}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="flex shrink-0 gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  filter === f
                    ? 'bg-brand text-white'
                    : 'border border-border text-ink-muted hover:text-ink'
                )}
              >
                {t(`filter.${f}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {audit.length === 0 ? (
          <Empty testid="audit-empty" text={t('empty')} />
        ) : rows.length === 0 ? (
          <Empty text={t('noMatch')} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-1.5">
            {rows.map(({ e, key }) => {
              const open = expanded.has(key)
              return (
                <div key={key} className="overflow-hidden rounded-lg border border-border bg-surface">
                  <button
                    onClick={() => toggle(key)}
                    aria-expanded={open}
                    aria-label={t('detail.expandRow', { tool: e.toolName })}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-card/50"
                  >
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                    )}
                    <span className="w-28 shrink-0 font-mono text-[11px] text-ink-muted">
                      {formatTime(e.ts)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-brand">
                      {e.toolName}
                    </span>
                    {e.error && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                    {e.approved ? (
                      <Badge className="shrink-0 bg-emerald-50 text-emerald-700">
                        <Check className="h-3 w-3" />
                        {t('approved')}
                      </Badge>
                    ) : (
                      <Badge className="shrink-0 bg-red-50 text-red-700">
                        <X className="h-3 w-3" />
                        {t('rejected')}
                      </Badge>
                    )}
                  </button>

                  {open && (
                    <div className="space-y-2 border-t border-border px-3 py-2.5 text-xs">
                      <Field label={t('detail.fullParams')}>
                        <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-card/50 p-2 font-mono text-[11px] text-ink">
                          {JSON.stringify(e.args ?? {}, null, 2)}
                        </pre>
                      </Field>
                      <Field label={t('detail.result')}>
                        {e.resultSummary ? (
                          <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-card/50 p-2 font-mono text-[11px] text-ink">
                            {e.resultSummary}
                          </pre>
                        ) : (
                          <span className="text-ink-muted">{t('detail.noResult')}</span>
                        )}
                      </Field>
                      {e.error && (
                        <Field label={t('detail.errorLabel')}>
                          <span className="text-red-600">{e.error}</span>
                        </Field>
                      )}
                      <div className="flex gap-4 pt-0.5 text-[11px] text-ink-muted">
                        <span>{t('detail.session')}: <span className="font-mono">{e.sessionId}</span></span>
                        <span className="font-mono">{new Date(e.ts).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      {children}
    </div>
  )
}

function Empty({ text, testid }: { text: string; testid?: string }): React.JSX.Element {
  return (
    <div data-testid={testid} className="mt-16 flex flex-col items-center text-center text-ink-muted">
      <FileWarning className="mb-3 h-8 w-8 opacity-50" />
      <p className="text-sm">{text}</p>
    </div>
  )
}
