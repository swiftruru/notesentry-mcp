/** 平台判斷與快捷鍵顯示（mac 用 ⌘、其他用 Ctrl）。 */
export const isMac =
  typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent)

/** 修飾鍵的顯示字串。 */
export const modKey = isMac ? '⌘' : 'Ctrl'

/** 組出快捷鍵提示，如 modKey + 'K' → "⌘K" / "Ctrl+K"。 */
export function shortcut(key: string): string {
  return isMac ? `${modKey}${key}` : `${modKey}+${key}`
}
