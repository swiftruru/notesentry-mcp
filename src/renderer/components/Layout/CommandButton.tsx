import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { shortcut } from '@/lib/platform'

/** 標題列的命令面板觸發鈕（顯示 ⌘K，供滑鼠使用者）。 */
export function CommandButton(): React.JSX.Element {
  const { t } = useTranslation('command')
  const setPaletteOpen = useAppStore((s) => s.setPaletteOpen)

  return (
    <button
      onClick={() => setPaletteOpen(true)}
      title={t('openTooltip')}
      aria-label={t('openTooltip')}
      className="no-drag inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-brand hover:text-brand"
    >
      <Search className="h-3.5 w-3.5" />
      <kbd className="text-[10px] font-medium">{shortcut('K')}</kbd>
    </button>
  )
}
