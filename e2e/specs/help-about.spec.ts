import { test, expect } from '../fixtures/test'

test.describe('Help & About (offline)', () => {
  test('help and about views render', async ({ shell }) => {
    await shell.goto('help')
    await expect(shell.page.getByTestId('help-view')).toBeVisible()
    await shell.goto('about')
    await expect(shell.page.getByTestId('about-view')).toBeVisible()
  })
})
