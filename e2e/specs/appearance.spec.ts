import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect } from '../fixtures/test'

async function readConfig(dataDir: string): Promise<Record<string, unknown>> {
  const raw = await readFile(join(dataDir, 'config.json'), 'utf-8')
  return JSON.parse(raw)
}

test.describe('Appearance settings (offline)', () => {
  test('font scale changes root font-size and persists to config', async ({ appearance, dataDir }) => {
    await appearance.open()

    await appearance.setFontScale('lg')
    await expect(appearance.page.locator('html')).toHaveCSS('font-size', '18px')
    await expect.poll(async () => (await readConfig(dataDir)).fontScale).toBe('lg')

    // 還原成預設，避免影響同 worker 其他測試。
    await appearance.setFontScale('md')
    await expect(appearance.page.locator('html')).toHaveCSS('font-size', '16px')
  })

  test('high-contrast toggle flips aria-checked, html class and config', async ({ appearance, dataDir }) => {
    await appearance.open()

    await appearance.expectHighContrast(false)
    await appearance.toggleHighContrast()
    await appearance.expectHighContrast(true)
    await expect.poll(async () => (await readConfig(dataDir)).highContrast).toBe(true)

    // 還原。
    await appearance.toggleHighContrast()
    await appearance.expectHighContrast(false)
  })
})
