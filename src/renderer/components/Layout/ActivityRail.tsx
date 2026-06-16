import { useTranslation } from 'react-i18next'
import { useAppStore, ViewKey } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  MessageSquare,
  ClipboardList,
  Wrench,
  ScrollText,
  Settings,
  Stethoscope,
  Info
} from 'lucide-react'

type RailItem = { key: ViewKey; icon: typeof MessageSquare }

const ITEMS: RailItem[] = [
  { key: 'dashboard', icon: LayoutDashboard },
  { key: 'chat', icon: MessageSquare },
  { key: 'apps', icon: ClipboardList },
  { key: 'tools', icon: Wrench },
  { key: 'audit', icon: ScrollText },
  { key: 'settings', icon: Settings }
]

export function ActivityRail(): React.JSX.Element {
  const { t } = useTranslation('common')
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)

  const renderBtn = (it: RailItem): React.JSX.Element => {
    const Icon = it.icon
    const active = view === it.key
    const label = t(`nav.${it.key}`)
    // 「對話」圖示：不在對話頁→進入；已在對話頁→收合/展開對話清單（同 VS Code 行為）。
    const onClick = (): void => {
      if (it.key === 'chat' && view === 'chat') toggleSidebar()
      else setView(it.key)
    }
    return (
      <button
        key={it.key}
        onClick={onClick}
        title={it.key === 'chat' && active ? t('conversations:toggleSidebarHint') : label}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] transition-colors',
          active ? 'bg-surface text-brand' : 'text-white/70 hover:bg-white/10 hover:text-white'
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
        <span className="max-w-full truncate leading-none">{label}</span>
      </button>
    )
  }

  return (
    <div className="flex w-14 shrink-0 flex-col items-center border-r border-border bg-brand py-3">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white">
        <Stethoscope className="h-5 w-5" />
      </div>
      <nav className="flex flex-1 flex-col gap-1">{ITEMS.map(renderBtn)}</nav>
      {/* 關於放在最底部 */}
      <div className="mt-1 border-t border-white/15 pt-2">
        {renderBtn({ key: 'about', icon: Info })}
      </div>
    </div>
  )
}
