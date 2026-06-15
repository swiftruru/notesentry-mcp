import { useState, useRef, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/primitives'
import { SendHorizonal, Square } from 'lucide-react'

export function Composer(): React.JSX.Element {
  const { t } = useTranslation('chat')
  const [text, setText] = useState('')
  const isStreaming = useAppStore((s) => s.isStreaming)
  const pendingHitl = useAppStore((s) => s.pendingHitl)
  const send = useAppStore((s) => s.send)
  const abort = useAppStore((s) => s.abort)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const disabled = isStreaming || !!pendingHitl

  const submit = async (): Promise<void> => {
    if (disabled || !text.trim()) return
    const value = text
    setText('')
    await send(value)
    taRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <div className="border-t border-border bg-surface px-6 py-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <Textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={
            pendingHitl ? t('composer.placeholderHitl') : t('composer.placeholder')
          }
          className="max-h-40 min-h-[44px] flex-1"
          style={{ height: 'auto' }}
        />
        {isStreaming ? (
          <Button variant="danger" size="icon" onClick={abort} title={t('composer.stop')}>
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={submit}
            disabled={disabled || !text.trim()}
            title={t('composer.send')}
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-ink-muted">
        {t('composer.disclaimer')}
      </p>
    </div>
  )
}
