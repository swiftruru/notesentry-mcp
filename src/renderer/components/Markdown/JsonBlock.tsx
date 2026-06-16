import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

// 只註冊 json 語言（自訂高亮主題的 CSS 已由 Markdown.tsx 全域載入）。
hljs.registerLanguage('json', json)

/** 語法高亮的 JSON 區塊（用於工具呼叫參數與工具結果的原始 JSON）。
 *  copyable=true 時於右上角顯示 hover 複製鈕（與 Markdown 程式碼區塊一致）。 */
export function JsonBlock({
  code,
  className,
  copyable
}: {
  code: string
  className?: string
  copyable?: boolean
}): React.JSX.Element {
  const html = useMemo(() => {
    try {
      return hljs.highlight(code, { language: 'json' }).value
    } catch {
      return null
    }
  }, [code])

  const pre =
    html == null ? (
      <pre
        className={cn(
          'overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-ink',
          className
        )}
      >
        {code}
      </pre>
    ) : (
      <pre
        className={cn(
          'hljs overflow-auto rounded-lg border border-border bg-card p-3 font-mono text-xs leading-relaxed',
          className
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )

  if (!copyable) return pre

  return (
    <div className="group/json relative">
      <JsonCopyButton code={code} />
      {pre}
    </div>
  )
}

function JsonCopyButton({ code }: { code: string }): React.JSX.Element {
  const { t } = useTranslation('common')
  const [copied, setCopied] = useState(false)
  const copy = (): void => {
    void navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      title={t('actions.copy')}
      className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded bg-ink/5 px-1.5 py-1 text-[11px] text-ink-muted opacity-0 transition-opacity hover:bg-ink/10 hover:text-ink group-hover/json:opacity-100"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? t('actions.copied') : t('actions.copy')}
    </button>
  )
}
