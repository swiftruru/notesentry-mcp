import { memo, useState, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy } from 'lucide-react'
import 'highlight.js/styles/github-dark.css'

/** 從 React children 遞迴抽出純文字（用於複製程式碼，含 highlight 後的 span）。 */
function textOf(node: ReactNode): string {
  if (node == null || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'object' && 'props' in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children)
  }
  return ''
}

function CopyButton({ text }: { text: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = (): void => {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="absolute right-2 top-2 flex items-center gap-1 rounded bg-white/10 px-1.5 py-1 text-[11px] text-white/80 opacity-0 transition-opacity hover:bg-white/20 group-hover/code:opacity-100"
      title="複製程式碼"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? '已複製' : '複製'}
    </button>
  )
}

const components: Components = {
  pre({ children }) {
    return (
      <div className="group/code relative my-2">
        <CopyButton text={textOf(children)} />
        <pre className="overflow-x-auto rounded-lg bg-ink p-3 text-xs leading-relaxed text-white/90">
          {children}
        </pre>
      </div>
    )
  },
  code({ className, children, ...props }) {
    // 區塊程式碼（帶 language-xxx）交給 <pre> 包裝；其餘為行內 code。
    if (className?.includes('language-')) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    }
    return (
      <code
        className="rounded bg-card px-1 py-0.5 font-mono text-[0.85em] text-brand"
        {...props}
      >
        {children}
      </code>
    )
  }
}

function MarkdownImpl({ content }: { content: string }): React.JSX.Element {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export const Markdown = memo(MarkdownImpl)
