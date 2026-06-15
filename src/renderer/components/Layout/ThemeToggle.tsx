import { useTranslation } from 'react-i18next'
import { Monitor, Sun, Moon } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { applyTheme } from '@/lib/theme'
import type { ThemeMode } from '@shared/types'

const ORDER: ThemeMode[] = ['system', 'light', 'dark']
const ICON = { system: Monitor, light: Sun, dark: Moon }

/** 右上角主題切換鈕：循環 跟隨系統 → 淺色 → 深色。 */
export function ThemeToggle(): React.JSX.Element {
  const { t } = useTranslation('common')
  const theme = useAppStore((s) => s.config?.theme ?? 'system')
  const Icon = ICON[theme]

  const cycle = (): void => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]
    applyTheme(next)
    void window.api.setTheme(next)
    useAppStore.setState((s) => ({ config: s.config ? { ...s.config, theme: next } : s.config }))
  }

  return (
    <button
      onClick={cycle}
      title={t('theme.tooltip', { mode: t(`theme.${theme}`) })}
      aria-label={t('theme.tooltip', { mode: t(`theme.${theme}`) })}
      className="no-drag inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-ink transition-colors hover:border-brand hover:text-brand"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}
