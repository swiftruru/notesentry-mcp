import { useMemo } from 'react'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { cn } from '@/lib/utils'

// 只註冊 json 語言（github-dark 主題的 CSS 已由 Markdown.tsx 全域載入）。
hljs.registerLanguage('json', json)

/** 語法高亮的 JSON 區塊（用於工具呼叫參數與工具結果的原始 JSON）。 */
export function JsonBlock({
  code,
  className
}: {
  code: string
  className?: string
}): React.JSX.Element {
  const html = useMemo(() => {
    try {
      return hljs.highlight(code, { language: 'json' }).value
    } catch {
      return null
    }
  }, [code])

  if (html == null) {
    return (
      <pre
        className={cn(
          'overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-ink',
          className
        )}
      >
        {code}
      </pre>
    )
  }
  return (
    <pre
      className={cn(
        'hljs overflow-auto rounded-lg border border-border bg-card p-3 font-mono text-xs leading-relaxed',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
