import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageList } from './MessageList'
import { Composer } from './Composer'
import { FollowupBar } from './Suggestions'
import { ApprovalDialog } from '@/components/Hitl/ApprovalDialog'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'
import { DEFAULT_CONVERSATION_TITLE } from '@shared/types'
import { Pencil, Plus, Check, Download } from 'lucide-react'

export function ChatView(): React.JSX.Element {
  const { t } = useTranslation('chat')
  const rawTitle = useAppStore((s) => s.title)
  const title = rawTitle === DEFAULT_CONVERSATION_TITLE ? t('conversations:newChatTitle') : rawTitle
  const activeId = useAppStore((s) => s.activeId)
  const hasMessages = useAppStore((s) => s.messages.length > 0)
  const rename = useAppStore((s) => s.renameConversation)
  const newConversation = useAppStore((s) => s.newConversation)
  const exportMarkdown = useAppStore((s) => s.exportMarkdown)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const [toast, setToast] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const doExport = async (): Promise<void> => {
    const res = await exportMarkdown()
    if (res.saved) setToast(t('toast.exportedTo', { path: res.path }))
    else if (res.error) setToast(t('toast.exportFailed', { error: res.error }))
    if (res.saved || res.error) setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = (): void => {
    setEditing(false)
    if (activeId && draft.trim() && draft.trim() !== title) void rename(activeId, draft.trim())
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              onBlur={commit}
              className="rounded border border-ring bg-white px-2 py-1 text-sm text-ink outline-none"
            />
            <button onClick={commit} className="text-emerald-600" title={t('common:actions.confirm')}>
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-semibold text-ink">{title}</h1>
            {activeId && (
              <button
                onClick={() => {
                  setDraft(title)
                  setEditing(true)
                }}
                className="text-ink-muted hover:text-brand"
                title={t('common:actions.rename')}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-1">
          {hasMessages && (
            <Button
              variant="ghost"
              size="sm"
              onClick={doExport}
              title={t('header.exportTooltip')}
            >
              <Download className="h-3.5 w-3.5" />
              {t('header.export')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={newConversation}>
            <Plus className="h-3.5 w-3.5" />
            {t('conversations:newChat')}
          </Button>
        </div>
      </div>

      {toast && (
        <div className="animate-fade-in border-b border-border bg-emerald-50 px-6 py-2 text-xs text-emerald-700">
          {toast}
        </div>
      )}

      <MessageList />
      <FollowupBar />
      <Composer />
      <ApprovalDialog />
    </div>
  )
}
