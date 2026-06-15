import type { ThemeMode } from '@shared/types'

/**
 * 套用主題：在 documentElement 切換 `.dark` class（index.css 的 CSS 變數據此切換）。
 * `system` 模式跟隨作業系統 prefers-color-scheme，並監聽其變化即時更新。
 */
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null

export function applyTheme(theme: ThemeMode): void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const effectiveDark = theme === 'dark' || (theme === 'system' && mq.matches)
  document.documentElement.classList.toggle('dark', effectiveDark)

  // 重設既有監聽，僅 system 模式才跟隨 OS 變化。
  if (mediaListener) {
    mq.removeEventListener('change', mediaListener)
    mediaListener = null
  }
  if (theme === 'system') {
    mediaListener = (e: MediaQueryListEvent): void => {
      document.documentElement.classList.toggle('dark', e.matches)
    }
    mq.addEventListener('change', mediaListener)
  }
}
