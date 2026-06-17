import { test, expect } from '../fixtures/test'

async function openMcpTab(page: import('@playwright/test').Page): Promise<void> {
  await page.getByTestId('rail-item-settings').click()
  await page.getByTestId('settings-tab-mcp').click()
  await page.getByTestId('settings-mcp-import-input').waitFor({ state: 'visible' })
}

test.describe('Settings MCP import (offline)', () => {
  test('valid standard mcpServers JSON imports successfully', async ({ shell }) => {
    const page = shell.page
    await openMcpTab(page)
    await page
      .getByTestId('settings-mcp-import-input')
      .fill('{"mcpServers":{"demo":{"command":"npx","args":["-y","demo-server"]}}}')
    await page.getByTestId('settings-mcp-import').click()
    await expect(page.getByTestId('settings-mcp-import-msg')).toHaveAttribute('data-ok', 'true')
  })

  test('invalid JSON shows a failure message', async ({ shell }) => {
    const page = shell.page
    await openMcpTab(page)
    await page.getByTestId('settings-mcp-import-input').fill('not valid json {{{')
    await page.getByTestId('settings-mcp-import').click()
    await expect(page.getByTestId('settings-mcp-import-msg')).toHaveAttribute('data-ok', 'false')
  })
})
