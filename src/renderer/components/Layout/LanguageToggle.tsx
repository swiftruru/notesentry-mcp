import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import { SUPPORTED, languageMeta } from '@/i18n'
import { useAppStore } from '@/store/useAppStore'

/** 右上角單一語言切換鈕：點一下循環到下一個語言（2 語為切換、3+ 語為循環）。 */
export function LanguageToggle(): React.JSX.Element {
  const { t, i18n } = useTranslation('common')
  const setLanguage = useAppStore((s) => s.setLanguage)
  const current = i18n.language
  const idx = SUPPORTED.indexOf(current)
  const next = SUPPORTED[(idx + 1) % SUPPORTED.length] ?? SUPPORTED[0]

  const cycle = (): void => {
    setLanguage(next)
  }

  return (
    <button
      onClick={cycle}
      title={t('language.switchTooltip')}
      className="no-drag inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-brand hover:text-brand"
    >
      <Languages className="h-3.5 w-3.5" />
      {languageMeta[current]?.short ?? current}
    </button>
  )
}
