import { test, expect } from '../fixtures/test'

test.describe('Settings help tooltips (offline)', () => {
  test('hovering the temperature [?] reveals an explanation', async ({ shell }) => {
    const page = shell.page
    await page.getByTestId('rail-item-settings').click()
    await page.getByTestId('settings-tab-agent').click()

    const tip = page.getByTestId('info-temperature')
    await expect(tip).toBeVisible()

    // 預設隱藏，hover 後顯示對應說明（zh 內容含「溫度」）。
    await tip.hover()
    await expect(page.getByRole('tooltip').filter({ hasText: '溫度' })).toBeVisible()
  })
})
