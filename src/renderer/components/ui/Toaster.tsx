import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

const kindStyle = {
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircle2 },
  error: { box: 'border-red-200 bg-red-50 text-red-800', Icon: AlertCircle },
  info: { box: 'border-border bg-surface text-ink', Icon: Info }
}

/** 全域 toast：統一各動作的短暫回饋（已儲存/匯出/重連/刪除…）。掛在 App 一次。 */
export function Toaster(): React.JSX.Element {
  const toasts = useAppStore((s) => s.toasts)
  const dismiss = useAppStore((s) => s.dismissToast)

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2"
    >
      {toasts.map((toRender) => {
        const { box, Icon } = kindStyle[toRender.kind]
        return (
          <div
            key={toRender.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs shadow-lg animate-fade-in',
              box
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 break-words leading-snug">{toRender.msg}</span>
            <button
              onClick={() => dismiss(toRender.id)}
              className="shrink-0 opacity-60 hover:opacity-100"
              aria-label="dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
