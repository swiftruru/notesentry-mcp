import { test, expect } from '../../fixtures/live'

test.describe('Connection test (live)', () => {
  test('settings test reports Ollama ok @live', async ({ shell }) => {
    const page = shell.page
    await page.getByTestId('rail-item-settings').click()
    await page.getByTestId('settings-test').click()
    // listModels 成功 → Ollama 那列 data-ok=true（不依賴翻譯文字）。
    await expect(page.getByTestId('settings-test-ollama')).toHaveAttribute('data-ok', 'true', {
      timeout: 60_000
    })
  })
})
