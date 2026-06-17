import type { FontScale } from '@shared/types'

// 字級對應的根 font-size（px）；rem 連動全站文字（zoom 式）。
const FONT_PX: Record<FontScale, number> = { sm: 14, md: 16, lg: 18, xl: 20 }

/** 套用無障礙外觀：字級（documentElement font-size）＋高對比（documentElement class）。 */
export function applyAppearance(fontScale?: FontScale, highContrast?: boolean): void {
  const px = FONT_PX[fontScale ?? 'md'] ?? 16
  document.documentElement.style.fontSize = `${px}px`
  document.documentElement.classList.toggle('high-contrast', !!highContrast)
}
