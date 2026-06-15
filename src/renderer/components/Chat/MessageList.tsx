import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { MessageBubble } from './MessageBubble'
import { Markdown } from '@/components/Markdown/Markdown'
import { SuggestionChips } from './Suggestions'
import { Bot, Stethoscope, ChevronDown } from 'lucide-react'

export function MessageList(): React.JSX.Element {
  const { t } = useTranslation('chat')
  const messages = useAppStore((s) => s.messages)
  const streaming = useAppStore((s) => s.streaming)
  const isStreaming = useAppStore((s) => s.isStreaming)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // 只在「已貼近底部」時才自動捲動，避免使用者往上讀舊訊息時被硬拉到底。
  const atBottomRef = useRef(true)
  const [showJump, setShowJump] = useState(false)

  const onScroll = (): void => {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    atBottomRef.current = near
    setShowJump(!near)
  }

  useEffect(() => {
    if (atBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const jumpToLatest = (): void => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    atBottomRef.current = true
    setShowJump(false)
  }

  const showThinking = isStreaming && (!streaming || streaming.content === '')

  // 最後一則「有內文的 assistant」訊息 id（非串流中才顯示重新生成）。
  let lastAssistantId: string | null = null
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant' && messages[i].content.trim()) {
      lastAssistantId = messages[i].id
      break
    }
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto px-6 py-6"
        aria-live="polite"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {messages.length === 0 && !isStreaming && <EmptyState />}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isLastAssistant={!isStreaming && m.id === lastAssistantId}
          />
        ))}

        {/* 即時串流中的 assistant 文字（以 Markdown 呈現） */}
        {streaming && streaming.content && (
          <div className="flex animate-fade-in justify-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0 max-w-[80%] rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-2.5">
              <Markdown content={streaming.content} />
            </div>
          </div>
        )}

        {showThinking && (
          <div className="flex items-center gap-3 text-ink-muted">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex gap-1">
              <Dot delay="0s" />
              <Dot delay="0.2s" />
              <Dot delay="0.4s" />
            </div>
          </div>
        )}

          <div ref={bottomRef} />
        </div>
      </div>

      {showJump && (
        <button
          onClick={jumpToLatest}
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-md transition-colors hover:bg-card"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          {t('scrollToLatest')}
        </button>
      )}
    </div>
  )
}

function Dot({ delay }: { delay: string }): React.JSX.Element {
  return (
    <span
      className="h-2 w-2 animate-pulse-dot rounded-full bg-brand-secondary"
      style={{ animationDelay: delay }}
    />
  )
}

function EmptyState(): React.JSX.Element {
  const { t } = useTranslation('chat')
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-brand">
        <Stethoscope className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-semibold text-ink">NoteSentry</h2>
      <p className="mt-1 max-w-md text-sm text-ink-muted">{t('empty.desc')}</p>
      <div className="mt-5 w-full max-w-md">
        <SuggestionChips
          items={[t('empty.starter1'), t('empty.starter2'), t('empty.starter3')]}
        />
      </div>
    </div>
  )
}
