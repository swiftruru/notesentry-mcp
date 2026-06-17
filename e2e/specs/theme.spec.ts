import { test, expect } from '../fixtures/test'

test.describe('Theme (offline)', () => {
  test('command palette can switch to dark and back to light', async ({ palette }) => {
    const page = palette.page
    const isDark = (): Promise<boolean> =>
      page.evaluate(() => document.documentElement.classList.contains('dark'))

    // 經由命令面板直接設定主題（不依賴 system 偏好）。
    await palette.open()
    await palette.run('themeDark', 'dark')
    await expect.poll(isDark).toBe(true)

    await palette.open()
    await palette.run('themeLight', 'light')
    await expect.poll(isDark).toBe(false)
  })
})
