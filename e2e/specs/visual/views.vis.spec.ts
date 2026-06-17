import { test, expect } from '../../fixtures/visual'

/**
 * 視覺回歸：抓幾個穩定畫面的版面。動態區塊（健康燈、KPI、近期時間）以 mask 遮掉。
 * 基準圖依 OS 自動分檔（-darwin/-linux）；本機 opt-in，不納入 CI 閘門。
 * 首次或刻意更新版面：`npm run test:visual:update`。
 */
test.describe('Visual regression @visual', () => {
  test('about view @visual', async ({ shell }) => {
    await shell.goto('about')
    await expect(shell.page).toHaveScreenshot('about.png', {
      mask: [shell.page.getByTestId('health-status'), shell.page.getByTestId('app-version')]
    })
  })

  test('help view @visual', async ({ shell }) => {
    await shell.goto('help')
    await expect(shell.page).toHaveScreenshot('help.png', {
      mask: [shell.page.getByTestId('health-status')]
    })
  })

  test('dashboard view @visual', async ({ shell }) => {
    await shell.goto('dashboard')
    await expect(shell.page).toHaveScreenshot('dashboard.png', {
      mask: [
        shell.page.getByTestId('health-status'),
        shell.page.getByTestId('dashboard-health'),
        shell.page.getByTestId('dashboard-kpis'),
        shell.page.getByTestId('dashboard-recent')
      ]
    })
  })

  test('appearance settings @visual', async ({ shell }) => {
    await shell.goto('settings')
    await shell.page.getByTestId('settings-tab-appearance').click()
    await expect(shell.page.getByTestId('appearance-font-md')).toBeVisible()
    await expect(shell.page).toHaveScreenshot('appearance.png', {
      mask: [shell.page.getByTestId('health-status')]
    })
  })
})
