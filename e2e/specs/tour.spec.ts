import { test, expect } from '../fixtures/test'

test.describe('Feature tour (offline)', () => {
  test('start via command palette, step forward/back, then end', async ({ palette, shell }) => {
    const page = shell.page
    const overlay = page.getByTestId('tour-overlay')

    // 由命令面板啟動導覽。
    await palette.open()
    await palette.run('startTour', 'tour')
    await expect(overlay).toBeVisible()

    // 下一步數次、上一步一次（prev 在第一步為 disabled）。
    await page.getByTestId('tour-next').click()
    await page.getByTestId('tour-next').click()
    await expect(page.getByTestId('tour-prev')).toBeEnabled()
    await page.getByTestId('tour-prev').click()

    // 結束導覽，遮罩消失。
    await page.getByTestId('tour-end').click()
    await expect(overlay).toBeHidden()
  })
})
