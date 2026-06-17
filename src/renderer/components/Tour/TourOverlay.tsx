import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore, ViewKey } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Placement = 'center' | 'right' | 'left' | 'top' | 'bottom'

// 與 tour.json 的 steps[] 等長、索引對齊（文案走 i18n，這裡只定義目標與切換的 view）。
const STEPS: { target?: string; view?: ViewKey; placement: Placement }[] = [
  { placement: 'center' }, // 0 歡迎
  { target: 'rail', placement: 'right' }, // 1 功能列
  { target: 'main', view: 'dashboard', placement: 'center' }, // 2 儀表板
  { target: 'main', view: 'chat', placement: 'center' }, // 3 對話
  { target: 'main', view: 'apps', placement: 'center' }, // 4 應用
  { target: 'main', view: 'tools', placement: 'center' }, // 5 工具
  { target: 'main', view: 'audit', placement: 'center' }, // 6 稽核
  { target: 'main', view: 'settings', placement: 'center' }, // 7 設定
  { target: 'local', placement: 'bottom' }, // 8 資料留在本機
  { placement: 'center' } // 9 完成
]

const DIM = 'rgba(100, 116, 139, 0.45)' // 淺灰半透明遮罩

export function TourOverlay(): React.JSX.Element | null {
  const { t } = useTranslation('tour')
  const tourOpen = useAppStore((s) => s.tourOpen)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const returnView = useRef<ViewKey | null>(null)

  const total = STEPS.length
  const cur = STEPS[step]
  const isFirst = step === 0
  const isLast = step === total - 1

  const stepsText = t('steps', { returnObjects: true })
  const texts = Array.isArray(stepsText)
    ? (stepsText as { title: string; desc: string }[])
    : []

  const finish = (): void => {
    const s = useAppStore.getState()
    if (returnView.current) s.setView(returnView.current)
    s.endTour()
  }
  const handleNext = (): void => {
    if (isLast) finish()
    else setStep((s) => Math.min(total - 1, s + 1))
  }
  const handlePrev = (): void => setStep((s) => Math.max(0, s - 1))

  // 開場：記住進場前的 view、step 歸零。
  useEffect(() => {
    if (tourOpen) {
      returnView.current = useAppStore.getState().view
      setStep(0)
    }
  }, [tourOpen])

  // step 變更：切到該步對應的 view。
  useEffect(() => {
    if (!tourOpen) return
    const s = useAppStore.getState()
    if (cur.view && s.view !== cur.view) s.setView(cur.view)
  }, [tourOpen, step, cur.view])

  // 量測目標元素（等 view 轉場 + layout），並於 resize 重算。
  useLayoutEffect(() => {
    if (!tourOpen) return
    let raf = 0
    const measure = (): void => {
      if (!cur.target) {
        setRect(null)
        return
      }
      const el = document.querySelector(`[data-tour="${cur.target}"]`)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    const to = window.setTimeout(() => {
      raf = requestAnimationFrame(measure)
    }, cur.view ? 150 : 0)
    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(to)
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [tourOpen, step, cur.target, cur.view])

  // 鍵盤：→/Enter 下一步、← 上一步、Esc 結束（capture 以先於全域快捷鍵）。
  useEffect(() => {
    if (!tourOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        finish()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        handlePrev()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [tourOpen, step])

  if (!tourOpen) return null

  const centered = !rect || cur.placement === 'center'
  const cardStyle = computeCardStyle(rect, cur.placement)

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* 點擊攔截層：導覽期間阻擋誤觸 app（透明；視覺變暗交給聚光燈/全螢幕遮罩） */}
      <div className="pointer-events-auto absolute inset-0" />

      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-brand transition-all duration-200"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: `0 0 0 9999px ${DIM}`
          }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0" style={{ background: DIM }} />
      )}

      {/* 提示卡 */}
      <div
        data-testid="tour-overlay"
        role="dialog"
        aria-label={t('title')}
        className={cn(
          'pointer-events-auto absolute rounded-xl border border-border bg-surface p-4 shadow-xl',
          centered ? 'w-[340px] max-w-[90vw]' : ''
        )}
        style={cardStyle}
      >
        <div className="text-[11px] font-medium text-ink-muted">
          {t('counter', { current: step + 1, total })}
        </div>
        <h3 className="mt-1 text-sm font-semibold text-ink">{texts[step]?.title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{texts[step]?.desc}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            data-testid="tour-end"
            onClick={finish}
            className="rounded px-1.5 py-1 text-xs text-ink-muted transition-colors hover:text-ink"
          >
            {t('buttons.end')}
          </button>
          <div className="flex items-center gap-2">
            <Button data-testid="tour-prev" variant="outline" size="sm" onClick={handlePrev} disabled={isFirst}>
              {t('buttons.prev')}
            </Button>
            <Button data-testid="tour-next" size="sm" onClick={handleNext}>
              {isLast ? t('buttons.done') : t('buttons.next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function computeCardStyle(rect: DOMRect | null, placement: Placement): CSSProperties {
  if (!rect || placement === 'center') {
    return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  }
  const W = 320
  const estH = 210
  const gap = 12
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = rect.left
  let top = rect.bottom + gap
  if (placement === 'right') {
    left = rect.right + gap
    top = rect.top
  } else if (placement === 'left') {
    left = rect.left - W - gap
    top = rect.top
  } else if (placement === 'top') {
    left = rect.left
    top = rect.top - estH - gap
  }
  left = Math.min(Math.max(gap, left), vw - W - gap)
  top = Math.min(Math.max(gap, top), vh - estH - gap)
  return { left, top, width: W }
}
