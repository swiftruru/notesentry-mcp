import { test, expect } from '../fixtures/test'

test.describe('Audit view (offline)', () => {
  test('shows empty state and a disabled export when there are no entries', async ({ shell }) => {
    await shell.goto('audit')
    await expect(shell.page.getByTestId('audit-empty')).toBeVisible()
    await expect(shell.page.getByTestId('audit-export')).toBeDisabled()
  })
})
