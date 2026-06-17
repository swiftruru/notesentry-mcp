import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect } from '../fixtures/test'

/** exportDir 內是否有任一檔案內容含 needle。 */
async function anyFileContains(dir: string, needle: string): Promise<boolean> {
  const names = await readdir(dir)
  for (const n of names) {
    const c = await readFile(join(dir, n), 'utf-8')
    if (c.includes(needle)) return true
  }
  return false
}

test.describe('Export (offline, deterministic)', () => {
  test('case report and markdown export write files containing the conversation title', async ({
    conversations,
    exportDir
  }) => {
    const id = 'e2e-export-1'
    const title = 'E2E Export Case Report'

    // 種入含訊息的對話 → 切到聊天頁 → 開啟它（訊息載入後頁首才出現匯出鈕）。
    await conversations.seed(id, title, true)
    await conversations.openChat()
    await conversations.item(id).getByTestId('conversation-open').click()

    const page = conversations.page
    // 個案報告（確定性組裝，不需 LLM）→ 落檔到 NS_EXPORT_TEST_DIR。
    await page.getByTestId('chat-report').click()
    await expect.poll(() => anyFileContains(exportDir, title)).toBe(true)

    // Markdown 匯出 → 再產生一個檔。
    await page.getByTestId('chat-export').click()
    await expect.poll(async () => (await readdir(exportDir)).length).toBeGreaterThanOrEqual(2)
  })
})
