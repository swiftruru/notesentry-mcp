import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect } from '../fixtures/test'

/**
 * 治理稽核報表為確定性組裝（彙整稽核日誌、不需 LLM），離線即可測。
 * 空稽核也會產生報告（含摘要與「尚無紀錄」），故可在離線套件驗證匯出管線與內容標記。
 */
test.describe('Governance report (offline)', () => {
  test('exporting from the audit view writes a governance report file', async ({ shell, exportDir }) => {
    await shell.goto('audit')
    await shell.page.getByTestId('audit-report').click()

    await expect
      .poll(async () => (await readdir(exportDir)).filter((f) => f.startsWith('notesentry-governance-')).length)
      .toBeGreaterThan(0)

    const file = (await readdir(exportDir)).find((f) => f.startsWith('notesentry-governance-'))!
    const content = await readFile(join(exportDir, file), 'utf-8')
    expect(content).toContain('NoteSentry')
  })
})
