import { test, expect } from '../fixtures/test'

test.describe('Language (offline)', () => {
  test('toggling language changes the document lang', async ({ shell }) => {
    const page = shell.page
    const htmlLang = (): Promise<string> => page.evaluate(() => document.documentElement.lang)

    const before = await htmlLang()
    await page.getByTestId('lang-toggle').click()
    await expect.poll(htmlLang).not.toBe(before)

    // 還原語言，避免影響同 worker 其他測試（循環回原語言，最多試幾次）。
    for (let i = 0; i < 4 && (await htmlLang()) !== before; i++) {
      await page.getByTestId('lang-toggle').click()
      await page.waitForTimeout(50)
    }
    await expect.poll(htmlLang).toBe(before)
  })
})
