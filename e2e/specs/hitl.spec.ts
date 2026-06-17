import { test, expect } from '../fixtures/test'
import type { Page } from '@playwright/test'

/** 以 test-only hook 注入假 HITL 請求（window.__emitHitl 由 App.tsx 在測試模式掛上）。 */
async function emitHitl(page: Page, partial: Record<string, unknown> = {}): Promise<void> {
  await page.evaluate(
    (p) => (window as unknown as { __emitHitl: (x: unknown) => void }).__emitHitl(p),
    partial
  )
}

test.describe('HITL approval dialog (offline)', () => {
  test('approve closes the dialog', async ({ shell }) => {
    const page = shell.page
    await shell.goto('chat')
    await emitHitl(page)
    const dialog = page.getByTestId('hitl-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('query_notes')
    await page.getByTestId('hitl-approve').click()
    await expect(dialog).toBeHidden()
  })

  test('reject closes the dialog', async ({ shell }) => {
    const page = shell.page
    await shell.goto('chat')
    await emitHitl(page)
    await expect(page.getByTestId('hitl-dialog')).toBeVisible()
    await page.getByTestId('hitl-reject').click()
    await expect(page.getByTestId('hitl-dialog')).toBeHidden()
  })

  test('Escape rejects and Enter approves', async ({ shell }) => {
    const page = shell.page
    await shell.goto('chat')

    await emitHitl(page)
    await expect(page.getByTestId('hitl-dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('hitl-dialog')).toBeHidden()

    await emitHitl(page)
    await expect(page.getByTestId('hitl-dialog')).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('hitl-dialog')).toBeHidden()
  })
})
