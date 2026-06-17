import { test, expect } from '../../fixtures/live'

test.describe('Sample generation (live)', () => {
  test('AI generate populates the triage form @live', async ({ shell }) => {
    const page = shell.page
    await page.getByTestId('rail-item-apps').click()
    await page.getByTestId('apps-tab-triage').click()

    await page.getByTestId('apps-ai-generate').click()

    // 產生成功會填入主訴；即使模型回傳失敗也會 fallback 載入預設、仍有值。
    const field = page.getByTestId('apps-field-triage')
    await expect
      .poll(async () => (await field.inputValue()).trim().length, { timeout: 90_000 })
      .toBeGreaterThan(0)
  })
})
