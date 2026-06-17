import { test, expect } from '../fixtures/test'

const VIEWS = ['dashboard', 'chat', 'apps', 'tools', 'audit', 'settings', 'help', 'about']

test.describe('Navigation (offline)', () => {
  test('clicking each rail item switches the active view', async ({ shell }) => {
    for (const view of VIEWS) {
      await shell.goto(view)
      // 其餘導覽項不應同時為作用中。
      for (const other of VIEWS.filter((v) => v !== view)) {
        await expect(shell.railItem(other)).not.toHaveAttribute('aria-current', 'page')
      }
    }
  })
})
