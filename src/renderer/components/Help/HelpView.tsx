import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import {
  HelpCircle,
  Compass,
  Database,
  Stethoscope,
  Pill,
  HeartPulse,
  Server,
  Bot,
  ShieldCheck,
  ScrollText,
  ArrowDown,
  ShieldHalf,
  Lock,
  Keyboard,
  MessageCircleQuestion
} from 'lucide-react'

const PILLARS = [
  { icon: Database, key: 'his' },
  { icon: Stethoscope, key: 'clinical' },
  { icon: Pill, key: 'pharmacy' },
  { icon: HeartPulse, key: 'nis' }
] as const

const FLOW = [
  { icon: Server, key: 'route' },
  { icon: Bot, key: 'agent' },
  { icon: ShieldCheck, key: 'hitl' },
  { icon: ScrollText, key: 'audit' }
] as const

export function HelpView(): React.JSX.Element {
  const { t } = useTranslation('help')
  const startTour = useAppStore((s) => s.startTour)

  const shortcutsRaw = t('shortcuts', { returnObjects: true })
  const shortcuts = Array.isArray(shortcutsRaw)
    ? (shortcutsRaw as { keys: string; desc: string }[])
    : []
  const faqRaw = t('faq', { returnObjects: true })
  const faq = Array.isArray(faqRaw) ? (faqRaw as { q: string; a: string }[]) : []

  return (
    <div className="h-full overflow-y-auto">
      {/* Hero */}
      <div className="border-b border-border bg-gradient-to-br from-brand to-brand-secondary px-8 py-8 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-brand-accent" />
            <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
          </div>
          <p className="mt-1.5 max-w-xl text-sm text-white/85">{t('subtitle')}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4 bg-white/15 text-white hover:bg-white/25"
            onClick={startTour}
          >
            <Compass className="h-4 w-4" />
            {t('startTour')}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-8 px-8 py-8">
        {/* 系統架構 */}
        <section>
          <SectionTitle>{t('arch.title')}</SectionTitle>
          <p className="mb-3 text-xs leading-relaxed text-ink-muted">{t('arch.desc')}</p>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              {t('arch.pillarsTitle')}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {PILLARS.map((p) => {
                const Icon = p.icon
                return (
                  <div
                    key={p.key}
                    className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-card text-brand">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-ink">{t(`arch.${p.key}`)}</span>
                  </div>
                )
              })}
            </div>
            {/* 流程：四支柱 → 路由 → agent → HITL → 稽核 */}
            <div className="mt-3 flex flex-col items-center gap-1.5">
              {FLOW.map((f) => {
                const Icon = f.icon
                return (
                  <div key={f.key} className="flex w-full flex-col items-center gap-1.5">
                    <ArrowDown className="h-3.5 w-3.5 text-ink-muted" />
                    <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand/10 px-3 py-2 text-sm font-medium text-brand">
                      <Icon className="h-4 w-4" />
                      {t(`arch.${f.key}`)}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
              <Lock className="h-3.5 w-3.5 text-brand" />
              {t('arch.localNote')}
            </p>
          </div>
        </section>

        {/* 三層防線 */}
        <section>
          <SectionTitle>{t('flow.title')}</SectionTitle>
          <div className="space-y-2">
            {(['step1', 'step2', 'step3'] as const).map((s, i) => (
              <div
                key={s}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  {i + 1}
                </div>
                <p className="text-xs leading-relaxed text-ink">{t(`flow.${s}`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 為什麼要人類覆核 */}
        <section>
          <SectionTitle>
            <ShieldHalf className="h-3.5 w-3.5" />
            {t('hitl.title')}
          </SectionTitle>
          <ul className="space-y-1.5">
            {(['p1', 'p2', 'p3', 'p4'] as const).map((p) => (
              <li key={p} className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                {t(`hitl.${p}`)}
              </li>
            ))}
          </ul>
        </section>

        {/* 鍵盤快捷鍵 */}
        <section>
          <SectionTitle>
            <Keyboard className="h-3.5 w-3.5" />
            {t('shortcutsTitle')}
          </SectionTitle>
          <div className="overflow-hidden rounded-xl border border-border">
            {shortcuts.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 px-4 py-2.5 ${
                  i > 0 ? 'border-t border-border' : ''
                }`}
              >
                <kbd className="shrink-0 rounded border border-border bg-card px-2 py-0.5 font-mono text-[11px] text-ink">
                  {s.keys}
                </kbd>
                <span className="text-xs text-ink-muted">{s.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section>
          <SectionTitle>
            <MessageCircleQuestion className="h-3.5 w-3.5" />
            {t('faqTitle')}
          </SectionTitle>
          <div className="space-y-2">
            {faq.map((f, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="text-sm font-semibold text-ink">{f.q}</div>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
      {children}
    </h2>
  )
}
