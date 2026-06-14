import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'

/** 顯眼標示：資料全程留在本機（符合 PhysioNet DUA）。 */
export function LocalBadge(): React.JSX.Element {
  const { t } = useTranslation('common')
  return (
    <div
      className="no-drag inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-card px-3 py-1 text-xs font-semibold text-brand"
      title={t('badge.localTooltip')}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      {t('badge.local')}
    </div>
  )
}
