import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ConversationMeta } from '@shared/types'
import { useAppStore } from '@/store/useAppStore'
import { cn, formatRelative } from '@/lib/utils'
import { Pencil, Trash2, Check, X, MessageSquare } from 'lucide-react'

interface Props {
  meta: ConversationMeta
}

export function ConversationItem({ meta }: Props): React.JSX.Element {
  const { t } = useTranslation('common')
  const activeId = useAppStore((s) => s.activeId)
  const load = useAppStore((s) => s.loadConversation)
  const rename = useAppStore((s) => s.renameConversation)
  const del = useAppStore((s) => s.deleteConversation)

  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [draft, setDraft] = useState(meta.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const active = activeId === meta.id

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = (): void => {
    setEditing(false)
    if (draft.trim() && draft.trim() !== meta.title) void rename(meta.id, draft.trim())
    else setDraft(meta.title)
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') {
      setDraft(meta.title)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-md border border-ring bg-surface px-2 py-1.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={commit}
          aria-label={t('actions.rename')}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
        />
        <button
          onClick={commit}
          className="text-emerald-600"
          title={t('actions.confirm')}
          aria-label={t('actions.confirm')}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative rounded-md transition-colors',
        active ? 'bg-card' : 'hover:bg-card/60'
      )}
    >
      {/* 全區主要動作：載入對話（鍵盤可聚焦、Enter/空白開啟、整列任意處點擊也會觸發）。 */}
      <button
        onClick={() => void load(meta.id)}
        aria-label={t('conversations:openConversation', { title: meta.title })}
        className="absolute inset-0 z-0 cursor-pointer rounded-md"
      />
      {/* 內容疊在按鈕上方；pointer-events-none 讓點擊穿透到底層按鈕，動作鈕再各自 pointer-events-auto。 */}
      <div className="pointer-events-none relative z-10 flex flex-col gap-0.5 px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <MessageSquare
            className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-brand' : 'text-ink-muted')}
          />
          <span className="min-w-0 flex-1 truncate text-sm text-ink">{meta.title}</span>
          {/* hover 或鍵盤聚焦該列時顯示的操作 */}
          {!confirmDel && (
            <div className="pointer-events-auto hidden shrink-0 items-center gap-0.5 group-hover:flex group-focus-within:flex">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDraft(meta.title)
                setEditing(true)
              }}
              className="rounded p-0.5 text-ink-muted hover:bg-surface hover:text-brand"
              title={t('actions.rename')}
              aria-label={t('actions.rename')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setConfirmDel(true)
              }}
              className="rounded p-0.5 text-ink-muted hover:bg-surface hover:text-red-600"
              title={t('actions.delete')}
              aria-label={t('actions.delete')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {confirmDel && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                void del(meta.id)
              }}
              className="rounded px-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
            >
              {t('actions.delete')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setConfirmDel(false)
              }}
              className="rounded p-0.5 text-ink-muted hover:bg-surface"
              title={t('actions.cancel')}
              aria-label={t('actions.cancel')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
        <span className="pl-5 text-[11px] text-ink-muted">
          {formatRelative(meta.updatedAt, t)}
        </span>
      </div>
    </div>
  )
}
