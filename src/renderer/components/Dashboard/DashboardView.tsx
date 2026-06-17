import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { formatRelative } from '@/lib/utils'
import {
  ShieldCheck,
  RefreshCw,
  Cpu,
  Server,
  Database,
  Terminal,
  Wrench,
  Layers,
  CheckCircle2,
  XCircle,
  Plus,
  ClipboardList,
  ScrollText,
  Settings,
  History,
  Inbox
} from 'lucide-react'

/** 治理／稽核總覽：純前端彙整 store 內既有的 audit / tools / health 等狀態，零新增後端。 */
export function DashboardView(): React.JSX.Element {
  const { t } = useTranslation('dashboard')
  const { t: tc } = useTranslation('common')
  const audit = useAppStore((s) => s.audit)
  const tools = useAppStore((s) => s.tools)
  const health = useAppStore((s) => s.health)
  const conversations = useAppStore((s) => s.conversations)
  const refreshHealth = useAppStore((s) => s.refreshHealth)
  const setView = useAppStore((s) => s.setView)
  const newConversation = useAppStore((s) => s.newConversation)

  // 由 audit（+ tools 對映 server）即時推導所有指標。
  const m = useMemo(() => {
    const total = audit.length
    const approved = audit.filter((e) => e.approved).length
    const errors = audit.filter((e) => e.error).length
    const sessions = new Set(audit.map((e) => e.sessionId)).size

    const toolToServer = new Map(tools.map((tl) => [tl.name, tl.serverName]))
    const byToolMap = new Map<string, number>()
    const byPillarMap = new Map<string, number>()
    for (const e of audit) {
      byToolMap.set(e.toolName, (byToolMap.get(e.toolName) ?? 0) + 1)
      const pillar = toolToServer.get(e.toolName) ?? t('pillarOther')
      byPillarMap.set(pillar, (byPillarMap.get(pillar) ?? 0) + 1)
    }
    const byTool = [...byToolMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    const byPillar = [...byPillarMap.entries()].sort((a, b) => b[1] - a[1])
    const recent = audit.slice(-5).reverse()

    return {
      total,
      approved,
      rejected: total - approved,
      errors,
      sessions,
      approvalRate: total ? Math.round((approved / total) * 100) : 0,
      byTool,
      byPillar,
      recent
    }
  }, [audit, tools, t])

  const isEmpty = m.total === 0
  const maxTool = m.byTool[0]?.[1] ?? 1
  const maxPillar = m.byPillar[0]?.[1] ?? 1

  return (
    <div className="h-full overflow-y-auto">
      {/* 頁首 */}
      <div className="border-b border-border bg-gradient-to-br from-brand to-brand-secondary px-8 py-7 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-accent" />
            <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm text-white/85">{t('govNote')}</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-7 px-8 py-7">
        {/* 系統健康列 */}
        <section data-testid="dashboard-health">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t('healthTitle')}
            </h2>
            <button
              onClick={() => void refreshHealth()}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-card hover:text-ink"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('health.recheck')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HealthChip icon={Cpu} label={t('health.ollama')} ok={health.ollama.ok} />
            <HealthChip
              icon={Server}
              label={t('health.mcp')}
              ok={health.mcp.total > 0 && health.mcp.connected === health.mcp.total}
              value={`${health.mcp.connected}/${health.mcp.total}`}
            />
            <HealthChip icon={Database} label={t('health.db')} ok={health.db.exists} />
            <HealthChip icon={Terminal} label={t('health.python')} ok={health.python.ok} />
          </div>
        </section>

        {/* KPI 卡片 */}
        <section data-testid="dashboard-kpis" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi label={t('kpi.totalCalls')} value={m.total} />
          <Kpi label={t('kpi.approvalRate')} value={`${m.approvalRate}%`} tone="brand" />
          <Kpi label={t('kpi.rejected')} value={m.rejected} tone={m.rejected ? 'warn' : 'muted'} />
          <Kpi label={t('kpi.errors')} value={m.errors} tone={m.errors ? 'danger' : 'muted'} />
          <Kpi label={t('kpi.conversations')} value={conversations.length} />
        </section>

        {isEmpty ? (
          <section className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
            <Inbox className="mx-auto mb-3 h-8 w-8 text-ink-muted" />
            <h3 className="text-sm font-semibold text-ink">{t('empty.title')}</h3>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-muted">
              {t('empty.desc')}
            </p>
          </section>
        ) : (
          <>
            {/* 工具使用 + 各支柱活動 */}
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  <Wrench className="h-3.5 w-3.5" />
                  {t('toolUsage')}
                </h2>
                <div className="space-y-2">
                  {m.byTool.map(([name, count]) => (
                    <BarRow key={name} label={name} count={count} max={maxTool} mono />
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  <Layers className="h-3.5 w-3.5" />
                  {t('pillars')}
                </h2>
                <div className="space-y-2">
                  {m.byPillar.map(([name, count]) => (
                    <BarRow key={name} label={name} count={count} max={maxPillar} tone="accent" />
                  ))}
                </div>
              </section>
            </div>
          </>
        )}

        {/* 快速入口 */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('quickTitle')}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickCard icon={Plus} label={t('quick.newChat')} onClick={() => newConversation()} />
            <QuickCard icon={ClipboardList} label={t('quick.apps')} onClick={() => setView('apps')} />
            <QuickCard icon={ScrollText} label={t('quick.audit')} onClick={() => setView('audit')} />
            <QuickCard icon={Settings} label={t('quick.settings')} onClick={() => setView('settings')} />
          </div>
        </section>

        {/* 近期工具呼叫 */}
        {!isEmpty && (
          <section data-testid="dashboard-recent">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <History className="h-3.5 w-3.5" />
              {t('recent')}
            </h2>
            <button
              onClick={() => setView('audit')}
              className="w-full overflow-hidden rounded-xl border border-border text-left transition-colors hover:border-brand/40"
            >
              {m.recent.map((e, i) => (
                <div
                  key={`${e.ts}-${i}`}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5',
                    i > 0 && 'border-t border-border'
                  )}
                >
                  {e.approved && !e.error ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  )}
                  <span className="flex-1 truncate font-mono text-xs text-ink">{e.toolName}</span>
                  <span className="shrink-0 text-[11px] text-ink-muted">
                    {formatRelative(e.ts, tc)}
                  </span>
                </div>
              ))}
            </button>
          </section>
        )}
      </div>
    </div>
  )
}

function HealthChip({
  icon: Icon,
  label,
  ok,
  value
}: {
  icon: typeof Cpu
  label: string
  ok: boolean
  value?: string
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
          ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-ink">{label}</div>
        <div className={cn('text-[11px]', ok ? 'text-emerald-600' : 'text-rose-500')}>
          {value ?? (ok ? 'OK' : '—')}
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  tone = 'default'
}: {
  label: string
  value: number | string
  tone?: 'default' | 'brand' | 'warn' | 'danger' | 'muted'
}): React.JSX.Element {
  const toneCls = {
    default: 'text-ink',
    brand: 'text-brand',
    warn: 'text-amber-600',
    danger: 'text-rose-500',
    muted: 'text-ink-muted'
  }[tone]
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={cn('text-2xl font-bold tabular-nums', toneCls)}>{value}</div>
      <div className="mt-0.5 text-xs text-ink-muted">{label}</div>
    </div>
  )
}

function BarRow({
  label,
  count,
  max,
  mono,
  tone = 'brand'
}: {
  label: string
  count: number
  max: number
  mono?: boolean
  tone?: 'brand' | 'accent'
}): React.JSX.Element {
  const pct = Math.max(4, Math.round((count / max) * 100))
  const barCls = tone === 'accent' ? 'bg-brand-secondary' : 'bg-brand'
  return (
    <div className="flex items-center gap-3">
      <span className={cn('w-40 shrink-0 truncate text-xs text-ink', mono && 'font-mono')}>
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-card-foreground/5">
        <div className={cn('h-full rounded-full', barCls)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-ink-muted">{count}</span>
    </div>
  )
}

function QuickCard({
  icon: Icon,
  label,
  onClick
}: {
  icon: typeof Plus
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-4 py-4 text-center transition-colors hover:border-brand/40 hover:bg-card"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card text-brand">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-xs font-medium text-ink">{label}</span>
    </button>
  )
}
