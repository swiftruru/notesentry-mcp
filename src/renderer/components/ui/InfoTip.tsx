import * as React from 'react'
import { useTranslation } from 'react-i18next'

/**
 * 小小的「?」說明圖示：hover 或鍵盤聚焦時顯示一段補充說明。
 * 無障礙：button 有 aria-label 與 aria-describedby（指向 role="tooltip" 的內容），
 * 螢幕報讀器在聚焦時也會朗讀說明；視覺上以 group-hover / group-focus-within 顯示。
 */
export function InfoTip({
  contentKey,
  testid
}: {
  contentKey: string
  testid?: string
}): React.JSX.Element {
  const { t } = useTranslation('settings')
  const id = React.useId()
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        data-testid={testid}
        aria-label={t('help.aria')}
        aria-describedby={id}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] font-semibold leading-none text-ink-muted transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ?
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 hidden w-72 rounded-md border border-border bg-surface p-2.5 text-left text-xs font-normal leading-relaxed text-ink shadow-lg group-hover:block group-focus-within:block"
      >
        {t(contentKey)}
      </span>
    </span>
  )
}
