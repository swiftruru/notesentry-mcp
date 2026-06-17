import { useTranslation } from 'react-i18next'
import {
  Stethoscope,
  ShieldCheck,
  GraduationCap,
  FlaskConical,
  Database,
  UserCheck,
  ScrollText,
  Cpu,
  Lock,
  Heart
} from 'lucide-react'

const APP_VERSION = '0.3.4'

const TECH = [
  'Electron',
  'React',
  'TypeScript',
  'Tailwind CSS',
  'Model Context Protocol',
  'Ollama',
  'SQLite'
]

// 三層原則：圖示 + i18n 鍵（文字由 about.principles.* 提供）。
const PRINCIPLES = [
  { icon: Database, key: 'data' },
  { icon: UserCheck, key: 'human' },
  { icon: ScrollText, key: 'audit' }
] as const

export function AboutView(): React.JSX.Element {
  const { t } = useTranslation('about')
  return (
    <div className="h-full overflow-y-auto">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand to-brand-secondary px-8 py-12 text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-brand-accent/20" />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <Stethoscope className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">NoteSentry</h1>
          <p className="mt-2 max-w-md text-sm text-white/85">{t('tagline')}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-accent" />
            {t('versionBadge', { version: APP_VERSION })}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-7 px-8 py-8">
        {/* 介紹 */}
        <p className="text-sm leading-relaxed text-ink">{t('intro')}</p>

        {/* 隱私核心 */}
        <div className="rounded-xl border border-brand/15 bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-brand">{t('privacyTitle')}</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{t('privacyDesc')}</p>
            </div>
          </div>
        </div>

        {/* 三層防線 */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('principlesTitle')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {PRINCIPLES.map((p) => {
              const Icon = p.icon
              return (
                <div
                  key={p.key}
                  className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-brand/40"
                >
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-card text-brand">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-semibold text-ink">
                    {t(`principles.${p.key}.title`)}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    {t(`principles.${p.key}.desc`)}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* 開發團隊 */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('teamTitle')}
          </h2>
          <div className="overflow-hidden rounded-xl border border-border">
            {/* 研究生 */}
            <div className="flex items-center gap-4 bg-card/60 px-5 py-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
                {t('person.initial')}
              </div>
              <div>
                <div className="text-base font-semibold text-ink">{t('person.name')}</div>
                <div className="text-xs text-ink-muted">{t('person.role')}</div>
              </div>
            </div>
            {/* 實驗室 */}
            <Row
              icon={<FlaskConical className="h-4 w-4" />}
              title={t('lab.name')}
              sub={t('lab.sub')}
            />
            {/* 學校 */}
            <Row
              icon={<GraduationCap className="h-4 w-4" />}
              title={t('school.name')}
              sub={t('school.sub')}
              last
            />
          </div>
        </section>

        {/* 技術堆疊 */}
        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <Cpu className="h-3.5 w-3.5" />
            {t('techTitle')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {TECH.map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink-muted"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-border pt-5 text-center">
          <p className="flex items-center justify-center gap-1.5 text-xs text-ink-muted">
            {t('dataSource')}
          </p>
          <p className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-ink-muted">
            {t('footerPre')} <Heart className="h-3 w-3 text-brand-accent" /> {t('footerPost')}
          </p>
        </div>
      </div>
    </div>
  )
}

function Row({
  icon,
  title,
  sub,
  last
}: {
  icon: React.ReactNode
  title: string
  sub: string
  last?: boolean
}): React.JSX.Element {
  return (
    <div
      className={`flex items-center gap-4 px-5 py-3.5 ${last ? '' : 'border-b border-border'}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-card text-brand">
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="text-xs text-ink-muted">{sub}</div>
      </div>
    </div>
  )
}
