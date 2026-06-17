import { test, expect } from '../../fixtures/live-tools'

/**
 * 治理核心流程：真模型觸發 MIMIC 工具 → HITL 核可 → 工具執行 → 稽核紀錄。
 * 最易 flaky（小模型未必呼叫工具）→ 獨立 @live-tools tag、可單獨跳過；逾時 180s。
 */
test.describe('HITL tool-call governance flow (live-tools)', () => {
  test('triggering a MIMIC tool requires approval and is audited @live-tools', async ({ shell }) => {
    const page = shell.page

    await page.getByTestId('rail-item-chat').click()
    await page.getByTestId('conversation-new').click()
    await page
      .getByTestId('composer-input')
      .fill('請使用工具查詢 subject_id 10006 的病歷重點，並簡短摘要。')
    await page.getByTestId('composer-send').click()

    // 模型決定呼叫工具後，核可對話框出現 → 核可。
    await expect(page.getByTestId('hitl-dialog')).toBeVisible({ timeout: 120_000 })
    await page.getByTestId('hitl-approve').click()

    // 核可後應產生最終助理訊息。
    await expect(page.getByTestId('message-assistant').last()).toBeVisible({ timeout: 120_000 })

    // 稽核頁應留下紀錄（核可的工具呼叫）。
    await page.getByTestId('rail-item-audit').click()
    await expect(page.getByTestId('audit-empty')).toHaveCount(0, { timeout: 10_000 })
  })
})
