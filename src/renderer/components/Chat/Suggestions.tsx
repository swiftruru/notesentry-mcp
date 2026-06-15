import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { Sparkles, ArrowUpRight } from 'lucide-react'

/** 可點擊的建議問句晶片（點了直接送出）。 */
export function SuggestionChips({
  items,
  variant = 'block'
}: {
  items: string[]
  variant?: 'block' | 'inline'
}): React.JSX.Element | null {
  const send = useAppStore((s) => s.send)
  const isStreaming = useAppStore((s) => s.isStreaming)
  const pendingHitl = useAppStore((s) => s.pendingHitl)
  if (items.length === 0) return null
  const disabled = isStreaming || !!pendingHitl

  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((q) => (
          <button
            key={q}
            disabled={disabled}
            onClick={() => void send(q)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink transition-colors hover:border-brand hover:bg-card disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3 text-brand-accent" />
            {q}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-2 text-left text-sm">
      {items.map((q) => (
        <button
          key={q}
          disabled={disabled}
          onClick={() => void send(q)}
          className="group flex items-center justify-between gap-2 rounded-md border border-border bg-card/50 px-3 py-2 text-ink-muted transition-colors hover:border-brand hover:bg-card hover:text-ink disabled:opacity-50"
        >
          <span>{q}</span>
          <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      ))}
    </div>
  )
}

/** 對話下方的「後續建議」列：依模型產生的建議顯示，串流/待核可時隱藏。 */
export function FollowupBar(): React.JSX.Element | null {
  const { t } = useTranslation('chat')
  const suggestions = useAppStore((s) => s.suggestions)
  const isStreaming = useAppStore((s) => s.isStreaming)
  const pendingHitl = useAppStore((s) => s.pendingHitl)
  if (suggestions.length === 0 || isStreaming || pendingHitl) return null

  return (
    <div className="mx-auto max-w-3xl px-6 pb-2">
      <div className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-ink-muted">
        <Sparkles className="h-3 w-3 text-brand-accent" />
        {t('suggestions.followupLabel')}
      </div>
      <SuggestionChips items={suggestions} variant="inline" />
    </div>
  )
}
