import { test, expect } from '../fixtures/test'

test.describe('Command palette (offline)', () => {
  test('opens via keyboard, filters, and navigates', async ({ palette, shell }) => {
    // ⌘K / Ctrl+K 開啟。
    await palette.openByKeyboard()
    // 用英文關鍵字過濾（不受 UI 語言影響）。
    await palette.filter('settings')
    await expect(palette.item('goSettings')).toBeVisible()
    await palette.run('goSettings')
    await expect(shell.railItem('settings')).toHaveAttribute('aria-current', 'page')
  })

  test('opens via header button and jumps to audit', async ({ palette, shell }) => {
    await palette.open()
    await palette.run('goAudit', 'audit')
    await expect(shell.railItem('audit')).toHaveAttribute('aria-current', 'page')
  })
})
