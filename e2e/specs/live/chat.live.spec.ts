import { test, expect } from '../../fixtures/live'

test.describe('Chat streaming (live)', () => {
  test('a plain question streams a non-empty assistant reply @live', async ({ shell }) => {
    const page = shell.page
    await page.getByTestId('rail-item-chat').click()
    await page.getByTestId('conversation-new').click()

    await page.getByTestId('composer-input').fill('請用繁體中文、一句話回答：1 加 1 等於多少？')
    await page.getByTestId('composer-send').click()

    // 使用者訊息先出現。
    await expect(page.getByTestId('message-user')).toBeVisible({ timeout: 15_000 })

    // 助理訊息出現且有內容（MCP 已停用 → 不會有工具呼叫/HITL，直接回答）。
    const assistant = page.getByTestId('message-assistant').last()
    await expect(assistant).toBeVisible({ timeout: 90_000 })
    await expect
      .poll(async () => (await assistant.innerText()).trim().length, { timeout: 90_000 })
      .toBeGreaterThan(0)

    // 串流結束：串流暫存區塊消失（內容已落為正式訊息）。
    await expect(page.getByTestId('chat-streaming')).toHaveCount(0, { timeout: 90_000 })
  })
})
