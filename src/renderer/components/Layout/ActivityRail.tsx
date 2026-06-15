import { useTranslation } from 'react-i18next'
import { useAppStore, ViewKey } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import {
  MessageSquare,
  Wrench,
  ScrollText,
  Settings,
  Stethoscope,
  Info
} from 'lucide-react'

type RailItem = { key: ViewKey; icon: typeof MessageSquare }

const ITEMS: RailItem[] = [
  { key: 'chat', icon: MessageSquare },
  { key: 'tools', icon: Wrench },
  { key: 'audit', icon: ScrollText },
  { key: 'settings', icon: Settings }
]

export function ActivityRail(): React.JSX.Element {
  const { t } = useTranslation('common')
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)

  const renderBtn = (it: RailItem): React.JSX.Element => {
    const Icon = it.icon
    const active = view === it.key
    const label = t(`nav.${it.key}`)
    return (
      <button
        key={it.key}
        onClick={() => setView(it.key)}
        title={label}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] transition-colors',
          active ? 'bg-surface text-brand' : 'text-white/70 hover:bg-white/10 hover:text-white'
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
        {label}
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
