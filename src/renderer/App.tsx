import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore, ViewKey } from './store/useAppStore'
import { ActivityRail } from './components/Layout/ActivityRail'
import { LanguageToggle } from './components/Layout/LanguageToggle'
import { ConversationList } from './components/Conversations/ConversationList'
import { DashboardView } from './components/Dashboard/DashboardView'
import { ChatView } from './components/Chat/ChatView'
import { AppsView } from './components/Apps/AppsView'
import { AuditView } from './components/Audit/AuditView'
import { SettingsView } from './components/Settings/SettingsView'
import { AboutView } from './components/About/AboutView'
import { ToolPanel } from './components/Tools/ToolPanel'
import { LocalBadge } from './components/Layout/LocalBadge'
import { HealthStatus } from './components/Layout/HealthStatus'
import { ThemeToggle } from './components/Layout/ThemeToggle'
import { CommandButton } from './components/Layout/CommandButton'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { TourOverlay } from './components/Tour/TourOverlay'
import { Toaster } from './components/ui/Toaster'
import { Compass } from 'lucide-react'

export default function App(): React.JSX.Element {
  const { t } = useTranslation('common')
  const view = useAppStore((s) => s.view)
  const init = useAppStore((s) => s.init)
  const startTour = useAppStore((s) => s.startTour)
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)

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

  // 首次啟動自動開啟特色導覽（之後可從 header 鈕／命令面板手動再開）。
  useEffect(() => {
    if (localStorage.getItem('ns.tourSeen') === '1') return
    const id = window.setTimeout(() => startTour(), 700)
    return () => clearTimeout(id)
  }, [startTour])

  // 全域快捷鍵（mac ⌘、其他 Ctrl）。讀寫一律走 getState，避免 stale closure。
  useEffect(() => {
    const VIEWS: ViewKey[] = ['dashboard', 'chat', 'apps', 'tools', 'audit', 'settings']
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      const s = useAppStore.getState()

      // ⌘K：任何時候開／關命令面板。
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        s.setPaletteOpen(!s.paletteOpen)
        return
      }
      // 面板開啟時，其餘按鍵交給面板自身處理（Esc 由面板關閉）。
      if (s.paletteOpen) return

      if (mod && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault()
        s.newConversation()
      } else if (mod && e.key === ',') {
        e.preventDefault()
        s.setView('settings')
      } else if (mod && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault()
        if (s.messages.length > 0) void s.exportCurrentChat()
      } else if (mod && e.key >= '1' && e.key <= '6') {
        e.preventDefault()
        s.setView(VIEWS[Number(e.key) - 1])
      } else if (e.key === 'Escape') {
        // 生成中按 Esc 停止（HITL 開啟時讓核可框自己處理）。
        if (s.isStreaming && !s.pendingHitl) {
          e.preventDefault()
          void s.abort()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-screen flex-col bg-card/40">
      {/* 標題列 */}
      <header className="drag-region flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface pl-20 pr-4">
        <span className="text-sm font-bold tracking-tight text-ink">
          NoteSentry
          <span className="ml-2 text-xs font-normal text-ink-muted">
            {t('app.subtitle')}
          </span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={startTour}
            title={t('nav.tour')}
            aria-label={t('nav.tour')}
            className="no-drag flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs text-ink-muted transition-colors hover:bg-card hover:text-ink"
          >
            <Compass className="h-3.5 w-3.5" />
            {t('nav.tour')}
          </button>
          <CommandButton />
          <HealthStatus />
          <ThemeToggle />
          <LanguageToggle />
          <span data-tour="local">
            <LocalBadge />
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <ActivityRail />

        {view === 'dashboard' && (
          <main data-tour="main" className="min-w-0 flex-1 bg-surface">
            <DashboardView />
          </main>
        )}

        {view === 'chat' && (
          <>
            {!sidebarCollapsed && <ConversationList />}
            <main data-tour="main" className="min-w-0 flex-1 bg-surface">
              <ChatView />
            </main>
          </>
        )}

        {view === 'apps' && (
          <main data-tour="main" className="min-w-0 flex-1 bg-surface">
            <AppsView />
          </main>
        )}

        {view === 'tools' && (
          <main data-tour="main" className="min-w-0 flex-1 bg-surface">
            <div className="mx-auto h-full max-w-2xl">
              <ToolPanel />
            </div>
          </main>
        )}

        {view === 'audit' && (
          <main data-tour="main" className="min-w-0 flex-1 bg-surface">
            <AuditView />
          </main>
        )}

        {view === 'settings' && (
          <main data-tour="main" className="min-w-0 flex-1 bg-surface">
            <SettingsView />
          </main>
        )}

        {view === 'about' && (
          <main data-tour="main" className="min-w-0 flex-1 bg-surface">
            <AboutView />
          </main>
        )}
      </div>

      <Toaster />
      <CommandPalette />
      <TourOverlay />
    </div>
  )
}
