import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatMessage } from '@shared/types'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import { Markdown } from '@/components/Markdown/Markdown'
import { JsonBlock } from '@/components/Markdown/JsonBlock'
import { ToolResult } from './ToolResult'
import {
  Wrench,
  User,
  Bot,
  AlertTriangle,
  Database,
  Copy,
  Check,
  RefreshCw
} from 'lucide-react'

interface Props {
  message: ChatMessage
  /** 是否為對話中的最後一則 assistant 訊息（顯示重新生成） */
  isLastAssistant?: boolean
}

export function MessageBubble({ message, isLastAssistant }: Props): React.JSX.Element {
  const { t } = useTranslation('chat')
  const { role } = message

  if (role === 'user') {
    return (
      <div data-testid="message-user" className="flex animate-fade-in justify-end gap-3">
        <div className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-brand px-4 py-2.5 text-sm leading-relaxed text-white">
          {message.content}
        </div>
        <Avatar className="bg-brand text-white">
          <User className="h-4 w-4" />
        </Avatar>
      </div>
    )
  }

  if (role === 'tool') {
    return (
      <div className="flex animate-fade-in justify-start gap-3">
        <Avatar className="bg-brand-accent/30 text-brand">
          <Database className="h-4 w-4" />
        </Avatar>
        <div className="min-w-0 max-w-[80%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {t('message.toolResult')}
          </div>
          <ToolResult content={message.content} />
        </div>
      </div>
    )
  }

  if (role === 'system') {
    return <SystemError id={message.id} content={message.content} />
  }

  // assistant
  return (
    <div data-testid="message-assistant" className="flex animate-fade-in justify-start gap-3">
      <Avatar className="bg-brand-secondary text-white">
        <Bot className="h-4 w-4" />
      </Avatar>
      <div className="min-w-0 max-w-[80%] space-y-2">
        {message.content && (
          <div className="rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-2.5">
            <Markdown content={message.content} />
          </div>
        )}
        {message.toolCalls?.map((tc) => (
          <div
            key={tc.id}
            className="flex items-start gap-2 rounded-md border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-xs text-ink"
          >
            <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
            <div className="min-w-0">
              <span className="font-semibold">{t('message.toolCallLabel')}</span>
              <span className="font-mono text-brand">{tc.name}</span>
              <JsonBlock code={JSON.stringify(tc.args, null, 2)} className="mt-1" copyable />
            </div>
          </div>
        ))}
        {message.content && (
          <MessageActions text={message.content} isLastAssistant={isLastAssistant} />
        )}
      </div>
    </div>
  )
}

function MessageActions({
  text,
  isLastAssistant
}: {
  text: string
  isLastAssistant?: boolean
}): React.JSX.Element {
  const { t } = useTranslation('chat')
  const [copied, setCopied] = useState(false)
  const isStreaming = useAppStore((s) => s.isStreaming)
  const regenerate = useAppStore((s) => s.regenerate)

  const copy = (): void => {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-1 pl-1 text-ink-muted">
      <button
        onClick={copy}
        className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] hover:bg-card hover:text-ink"
        title={t('message.copyTooltip')}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? t('common:actions.copied') : t('common:actions.copy')}
      </button>
      {isLastAssistant && (
        <button
          onClick={() => void regenerate()}
          disabled={isStreaming}
          className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] hover:bg-card hover:text-ink disabled:opacity-40"
          title={t('message.regenerate')}
        >
          <RefreshCw className="h-3 w-3" />
          {t('message.regenerate')}
        </button>
      )}
    </div>
  )
}

function SystemError({ id, content }: { id: string; content: string }): React.JSX.Element {
  const { t } = useTranslation('chat')
  const regenerate = useAppStore((s) => s.regenerate)
  const dismissMessage = useAppStore((s) => s.dismissMessage)
  const isStreaming = useAppStore((s) => s.isStreaming)

  return (
    <div className="flex animate-fade-in flex-col items-center gap-1.5">
      <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        {content}
      </div>
      <div className="flex items-center gap-1 text-ink-muted">
        <button
          onClick={() => void regenerate()}
          disabled={isStreaming}
          className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] hover:bg-card hover:text-ink disabled:opacity-40"
        >
          <RefreshCw className="h-3 w-3" />
          {t('message.retry')}
        </button>
        <button
          onClick={() => dismissMessage(id)}
          className="rounded px-1.5 py-1 text-[11px] hover:bg-card hover:text-ink"
        >
          {t('message.dismiss')}
        </button>
      </div>
    </div>
  )
}

function Avatar({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
        className
      )}
    >
      {children}
    </div>
  )
}
