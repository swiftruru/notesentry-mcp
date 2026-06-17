import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { SUPPORTED, languageMeta } from '@/i18n'
import i18n from '@/i18n'
import { shortcut } from '@/lib/platform'
import { cn } from '@/lib/utils'
import {
  Plus,
  LayoutDashboard,
  MessageSquare,
  ClipboardList,
  Wrench,
  ScrollText,
  Settings,
  Info,
  HelpCircle,
  Download,
  FileText,
  RefreshCw,
  Activity,
  Monitor,
  Sun,
  Moon,
  Languages,
  Compass,
  Search,
  MessagesSquare,
  CornerDownLeft
} from 'lucide-react'

interface Cmd {
  id: string
  label: string
  hint?: string
  icon: typeof Plus
  keywords?: string[]
  run: () => void
}

/** ⌘K 命令面板：可搜尋的指令清單 + 跳到對話；鍵盤 ↑/↓ 選取、Enter 執行、Esc 關閉。 */
export function CommandPalette(): React.JSX.Element | null {
  const { t } = useTranslation('command')
  const open = useAppStore((s) => s.paletteOpen)
  const setOpen = useAppStore((s) => s.setPaletteOpen)
  const conversations = useAppStore((s) => s.conversations)
  const hasMessages = useAppStore((s) => s.messages.length > 0)

  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const prevFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      prevFocus.current = document.activeElement as HTMLElement
      setQuery('')
      setSel(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      prevFocus.current?.focus?.()
    }
  }, [open])

  // 指令清單（依目前語言/是否有訊息重建）。
  const commands = useMemo<Cmd[]>(() => {
    const s = useAppStore.getState()
    const nextLng = SUPPORTED[(SUPPORTED.indexOf(i18n.language) + 1) % SUPPORTED.length]
    const list: Cmd[] = [
      { id: 'newChat', label: t('cmd.newChat'), hint: shortcut('N'), icon: Plus, keywords: ['new', '新', '對話'], run: () => s.newConversation() },
      { id: 'goDashboard', label: t('cmd.goDashboard'), hint: shortcut('1'), icon: LayoutDashboard, keywords: ['dashboard', '儀表板', '總覽', '治理'], run: () => s.setView('dashboard') },
      { id: 'goChat', label: t('cmd.goChat'), hint: shortcut('2'), icon: MessageSquare, keywords: ['chat', '對話'], run: () => s.setView('chat') },
      { id: 'goApps', label: t('cmd.goApps'), hint: shortcut('3'), icon: ClipboardList, keywords: ['apps', '應用', '檢傷', 'soap', 'triage'], run: () => s.setView('apps') },
      { id: 'goTools', label: t('cmd.goTools'), hint: shortcut('4'), icon: Wrench, keywords: ['tools', '工具', 'mcp'], run: () => s.setView('tools') },
      { id: 'goAudit', label: t('cmd.goAudit'), hint: shortcut('5'), icon: ScrollText, keywords: ['audit', '稽核', 'log'], run: () => s.setView('audit') },
      { id: 'goSettings', label: t('cmd.goSettings'), hint: shortcut('6'), icon: Settings, keywords: ['settings', '設定', 'preferences'], run: () => s.setView('settings') },
      { id: 'goAbout', label: t('cmd.goAbout'), icon: Info, keywords: ['about', '關於'], run: () => s.setView('about') },
      { id: 'goHelp', label: t('cmd.goHelp'), icon: HelpCircle, keywords: ['help', '說明', '文件', '架構', 'docs', 'faq'], run: () => s.setView('help') },
      { id: 'startTour', label: t('cmd.startTour'), icon: Compass, keywords: ['tour', '導覽', '教學', 'guide', 'onboarding'], run: () => s.startTour() },
      ...(hasMessages
        ? [
            { id: 'export', label: t('cmd.export'), hint: shortcut('E'), icon: Download, keywords: ['export', '匯出', 'markdown'], run: () => void s.exportCurrentChat() },
            { id: 'exportReport', label: t('cmd.exportReport'), icon: FileText, keywords: ['report', '個案', '報告', 'case'], run: () => void s.exportCaseReport() }
          ]
        : []),
      { id: 'reconnect', label: t('cmd.reconnect'), icon: RefreshCw, keywords: ['reconnect', '重連', 'mcp'], run: () => void s.reconnectMcp() },
      { id: 'recheck', label: t('cmd.recheck'), icon: Activity, keywords: ['health', '健康', '檢查', 'status'], run: () => void s.refreshHealth() },
      { id: 'themeSystem', label: t('cmd.themeSystem'), icon: Monitor, keywords: ['theme', '主題', 'system', '系統'], run: () => s.setTheme('system') },
      { id: 'themeLight', label: t('cmd.themeLight'), icon: Sun, keywords: ['theme', '主題', 'light', '淺色'], run: () => s.setTheme('light') },
      { id: 'themeDark', label: t('cmd.themeDark'), icon: Moon, keywords: ['theme', '主題', 'dark', '深色'], run: () => s.setTheme('dark') },
      { id: 'language', label: t('cmd.language', { lang: languageMeta[nextLng]?.self ?? nextLng }), icon: Languages, keywords: ['language', '語言', 'lang'], run: () => s.setLanguage(nextLng) }
    ]
    return list
  }, [t, hasMessages])

  if (!open) return null

  const q = query.trim().toLowerCase()
  const matchCmd = (c: Cmd): boolean =>
    !q || c.label.toLowerCase().includes(q) || (c.keywords ?? []).some((k) => k.toLowerCase().includes(q))
  const cmds = commands.filter(matchCmd)
  const convs = conversations
    .filter((c) => !q || c.title.toLowerCase().includes(q))
    .slice(0, 6)

  type Item = { type: 'cmd'; cmd: Cmd } | { type: 'conv'; id: string; title: string }
  const items: Item[] = [
    ...cmds.map((c) => ({ type: 'cmd' as const, cmd: c })),
    ...convs.map((c) => ({ type: 'conv' as const, id: c.id, title: c.title }))
  ]
  const selClamped = Math.min(sel, Math.max(0, items.length - 1))

  const run = (i: number): void => {
    const it = items[i]
    if (!it) return
    setOpen(false)
    if (it.type === 'cmd') it.cmd.run()
    else void useAppStore.getState().loadConversation(it.id)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(s + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(selClamped)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'Tab') {
      // 焦點鎖定：面板內唯一可聚焦的是輸入框，攔住 Tab 不讓焦點跑到背景。
      e.preventDefault()
    }
  }

  // 連續索引（跨兩個區段）以對齊鍵盤選取。
  let idx = -1

  return (
    <div
      className="fixed inset-0 z-[55] flex items-start justify-center bg-ink/30 p-4 pt-24 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div
        data-testid="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        className="w-full max-w-xl animate-fade-in overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-ink-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSel(0)
            }}
            onKeyDown={onKeyDown}
            data-testid="command-input"
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            role="combobox"
            aria-expanded={true}
            aria-controls="cmdk-listbox"
            aria-autocomplete="list"
            aria-activedescendant={items.length > 0 ? `cmdk-opt-${selClamped}` : undefined}
            className="w-full bg-transparent py-3 text-sm text-ink outline-none placeholder:text-ink-muted"
          />
        </div>

        <div id="cmdk-listbox" role="listbox" aria-label={t('title')} className="max-h-80 overflow-y-auto p-1.5">
          {items.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-ink-muted">{t('empty')}</div>
          )}

          {cmds.length > 0 && (
            <Section label={t('section.commands')}>
              {cmds.map((c) => {
                idx++
                const Icon = c.icon
                const active = idx === selClamped
                const myIdx = idx
                return (
                  <Row key={c.id} id={`cmdk-opt-${myIdx}`} testid={`command-item-${c.id}`} active={active} onClick={() => run(myIdx)}>
                    <Icon className="h-4 w-4 shrink-0 text-brand" />
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                    {c.hint && <kbd className="shrink-0 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">{c.hint}</kbd>}
                  </Row>
                )
              })}
            </Section>
          )}

          {convs.length > 0 && (
            <Section label={t('section.conversations')}>
              {convs.map((c) => {
                idx++
                const active = idx === selClamped
                const myIdx = idx
                return (
                  <Row key={c.id} id={`cmdk-opt-${myIdx}`} testid={`command-item-conv-${c.id}`} active={active} onClick={() => run(myIdx)}>
                    <MessagesSquare className="h-4 w-4 shrink-0 text-ink-muted" />
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  </Row>
                )
              })}
            </Section>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-3 py-1.5 text-[10px] text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> {t('section.commands')}
          </span>
          <span>↑ ↓</span>
          <span>Esc</span>
        </div>
      </div>
    </div>
  )
}

function Section({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div role="group" aria-label={label} className="mb-1">
      <div aria-hidden="true" className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      {children}
    </div>
  )
}

function Row({
  id,
  testid,
  active,
  onClick,
  children
}: {
  id: string
  testid?: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      id={id}
      data-testid={testid}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-ink transition-colors',
        active ? 'bg-card' : 'hover:bg-card/60'
      )}
    >
      {children}
    </button>
  )
}
