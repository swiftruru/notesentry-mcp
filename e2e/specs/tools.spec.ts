import { test, expect } from '../fixtures/test'

test.describe('Tools & data dictionary (offline)', () => {
  test('data-dictionary tab lists the MIMIC notes columns and filters by search', async ({ shell }) => {
    const page = shell.page
    await shell.goto('tools')

    // 預設在「工具目錄」分頁。
    await expect(page.getByTestId('tools-tab-catalog')).toHaveAttribute('aria-current', 'page')

    // 切到「資料字典」→ 靜態 schema 表（離線確定性）。
    await page.getByTestId('tools-tab-schema').click()
    const table = page.getByTestId('tools-schema-table')
    await expect(table).toBeVisible()
    await expect(table).toContainText('SUBJECT_ID')
    await expect(table).toContainText('TEXT')

    // 搜尋過濾欄位。
    await page.getByTestId('tools-search').fill('SUBJECT_ID')
    await expect(table).toContainText('SUBJECT_ID')
    await expect(table).not.toContainText('CHARTDATE')
  })
})
