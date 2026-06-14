import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from './store/useAppStore'
import { ActivityRail } from './components/Layout/ActivityRail'
import { LanguageToggle } from './components/Layout/LanguageToggle'
import { ConversationList } from './components/Conversations/ConversationList'
import { ChatView } from './components/Chat/ChatView'
import { AuditView } from './components/Audit/AuditView'
import { SettingsView } from './components/Settings/SettingsView'
import { AboutView } from './components/About/AboutView'
import { ToolPanel } from './components/Tools/ToolPanel'
import { LocalBadge } from './components/Layout/LocalBadge'

export default function App(): React.JSX.Element {
  const { t } = useTranslation('common')
  const view = useAppStore((s) => s.view)
  const init = useAppStore((s) => s.init)

  // 一次性：載入初始狀態並訂閱 main 推送的事件。
  useEffect(() => {
    void init()
    const s = useAppStore.getState()
    const unsubs = [
      window.api.onChatToken((e) => s._onToken(e.sessionId, e.messageId, e.delta)),
      window.api.onChatMessage((e) => s._onMessage(e.sessionId, e.message)),
      window.api.onChatDone((e) => s._onDone(e.sessionId)),
      window.api.onChatError((e) => s._onError(e.sessionId, e.error)),
      window.api.onHitlRequest((e) => s._onHitl(e)),
      window.api.onAuditNew((e) => s._onAudit(e)),
      window.api.onMcpStatus((e) => s._setMcpStatus(e)),
      window.api.onToolsUpdated((t) => s._setTools(t))
    ]
    return () => unsubs.forEach((u) => u())
  }, [init])

  return (
    <div className="flex h-screen flex-col bg-card/40">
      {/* 標題列 */}
      <header className="drag-region flex h-12 shrink-0 items-center justify-between border-b border-border bg-white pl-20 pr-4">
        <span className="text-sm font-bold tracking-tight text-ink">
          NoteSentry
          <span className="ml-2 text-xs font-normal text-ink-muted">
            {t('app.subtitle')}
          </span>
        </span>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <LocalBadge />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <ActivityRail />

        {view === 'chat' && (
          <>
            <ConversationList />
            <main className="min-w-0 flex-1 bg-white">
              <ChatView />
            </main>
          </>
        )}

        {view === 'tools' && (
          <main className="min-w-0 flex-1 bg-white">
            <div className="mx-auto h-full max-w-2xl">
              <ToolPanel />
            </div>
          </main>
        )}

        {view === 'audit' && (
          <main className="min-w-0 flex-1 bg-white">
            <AuditView />
          </main>
        )}

        {view === 'settings' && (
          <main className="min-w-0 flex-1 bg-white">
            <SettingsView />
          </main>
        )}

        {view === 'about' && (
          <main className="min-w-0 flex-1 bg-white">
            <AboutView />
          </main>
        )}
      </div>
    </div>
  )
}
