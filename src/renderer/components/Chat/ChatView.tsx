import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageList } from './MessageList'
import { Composer } from './Composer'
import { FollowupBar } from './Suggestions'
import { ApprovalDialog } from '@/components/Hitl/ApprovalDialog'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'
import { DEFAULT_CONVERSATION_TITLE } from '@shared/types'
import { primaryProblem } from '@/lib/health'
import {
  Pencil,
  Plus,
  Check,
  Download,
  AlertTriangle,
  Settings,
  X,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'

export function ChatView(): React.JSX.Element {
  const { t } = useTranslation('chat')
  const rawTitle = useAppStore((s) => s.title)
  const title = rawTitle === DEFAULT_CONVERSATION_TITLE ? t('conversations:newChatTitle') : rawTitle
  const activeId = useAppStore((s) => s.activeId)
  const hasMessages = useAppStore((s) => s.messages.length > 0)
  const rename = useAppStore((s) => s.renameConversation)
  const newConversation = useAppStore((s) => s.newConversation)
  const exportCurrentChat = useAppStore((s) => s.exportCurrentChat)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { t: tHealth } = useTranslation('health')
  const health = useAppStore((s) => s.health)
  const model = useAppStore((s) => s.config?.model ?? '')
  const setView = useAppStore((s) => s.setView)
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  // 啟動橫幅：只在真的有錯誤、聊天還空著、且使用者未關閉時出現。
  const problem =
    health.level === 'error' && !hasMessages && !bannerDismissed
      ? primaryProblem(health, model, tHealth)
      : null

  const doExport = (): Promise<void> => exportCurrentChat()

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
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={toggleSidebar}
            title={sidebarCollapsed ? t('conversations:expandSidebar') : t('conversations:collapseSidebar')}
            aria-label={
              sidebarCollapsed ? t('conversations:expandSidebar') : t('conversations:collapseSidebar')
            }
            className="shrink-0 text-ink-muted transition-colors hover:text-brand"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
          {editing ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              onBlur={commit}
              className="rounded border border-ring bg-surface px-2 py-1 text-sm text-ink outline-none"
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
        </div>
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

      {problem && (
        <div className="flex animate-fade-in items-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{tHealth('bannerPrefix')}</span>
            {problem}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('settings')}
            className="shrink-0 text-amber-800 hover:text-amber-900"
          >
            <Settings className="h-3.5 w-3.5" />
            {tHealth('bannerCta')}
          </Button>
          <button
            onClick={() => setBannerDismissed(true)}
            title={tHealth('dismiss')}
            aria-label={tHealth('dismiss')}
            className="shrink-0 text-amber-500 hover:text-amber-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <MessageList />
      <FollowupBar />
      <Composer />
      <ApprovalDialog />
    </div>
  )
}
