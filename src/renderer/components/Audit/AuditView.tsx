import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { Badge } from '@/components/ui/primitives'
import { formatTime } from '@/lib/utils'
import { Check, X, ScrollText, FileWarning } from 'lucide-react'

export function AuditView(): React.JSX.Element {
  const { t } = useTranslation('audit')
  const audit = useAppStore((s) => s.audit)
  const ordered = [...audit].reverse() // 新的在上

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-3">
        <h1 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ScrollText className="h-4 w-4 text-brand" />
          {t('title')}
        </h1>
        <p className="text-xs text-ink-muted">{t('desc')}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {ordered.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center text-ink-muted">
            <FileWarning className="mb-3 h-8 w-8 opacity-50" />
            <p className="text-sm">{t('empty')}</p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-card text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('col.time')}</th>
                  <th className="px-3 py-2 font-medium">{t('col.tool')}</th>
                  <th className="px-3 py-2 font-medium">{t('col.params')}</th>
                  <th className="px-3 py-2 font-medium">{t('col.approval')}</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((e, i) => (
                  <tr
                    key={`${e.ts}-${i}`}
                    className="border-t border-border align-top"
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-ink-muted">
                      {formatTime(e.ts)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-brand">
                      {e.toolName}
                    </td>
                    <td className="px-3 py-2">
                      <pre className="max-w-xs whitespace-pre-wrap break-words font-mono text-[11px] text-ink-muted">
                        {JSON.stringify(e.args)}
                      </pre>
                      {e.error && (
                        <div className="mt-1 text-[11px] text-red-600">
                          {t('error', { error: e.error })}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {e.approved ? (
                        <Badge className="bg-emerald-50 text-emerald-700">
                          <Check className="h-3 w-3" />
                          {t('approved')}
                        </Badge>
                      ) : (
                        <Badge className="bg-red-50 text-red-700">
                          <X className="h-3 w-3" />
                          {t('rejected')}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
