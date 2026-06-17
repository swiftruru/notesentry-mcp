import { type Page, type Locator } from '@playwright/test'

/**
 * 對話清單（聊天頁側欄）。
 * 離線時 UI 無法產生對話（需 LLM），故以 IPC（window.api.saveConversation）植入種子資料、
 * reload 讓 store 重新載入，再用 UI 驗改名／刪除。
 */
export class ConversationsPage {
  constructor(readonly page: Page) {}

  item(id: string): Locator {
    return this.page.getByTestId(`conversation-item-${id}`)
  }
  search(): Locator {
    return this.page.getByTestId('conversation-search')
  }

  /** 切到聊天頁（顯示側欄對話清單）。 */
  async openChat(): Promise<void> {
    await this.page.getByTestId('rail-item-chat').click()
    await this.page.getByTestId('conversation-list').waitFor({ state: 'visible' })
  }

  /** 以 IPC 植入一筆對話，reload 後讓清單載入。 */
  async seed(id: string, title: string): Promise<void> {
    await this.page.evaluate(
      async ({ id, title }) => {
        const now = Date.now()
        // window.api 由 preload 暴露；測試情境下以 any 取用。
        await (window as unknown as { api: { saveConversation: (c: unknown) => Promise<unknown> } }).api.saveConversation(
          { id, title, createdAt: now, updatedAt: now, messages: [] }
        )
      },
      { id, title }
    )
    await this.page.reload()
    await this.page.waitForLoadState('domcontentloaded')
    await this.page.getByTestId('rail-item-dashboard').waitFor({ state: 'visible' })
  }

  /** 改名（hover 顯示操作鈕 → 改名 → 輸入 → Enter）。 */
  async rename(id: string, newTitle: string): Promise<void> {
    const item = this.item(id)
    await item.hover()
    const renameBtn = item.getByTestId('conversation-rename')
    await renameBtn.waitFor({ state: 'visible' })
    await renameBtn.click()
    const input = this.page.getByTestId('conversation-rename-input')
    await input.fill(newTitle)
    await input.press('Enter')
  }

  /** 刪除（hover → 刪除 → 確認）。 */
  async remove(id: string): Promise<void> {
    const item = this.item(id)
    await item.hover()
    const delBtn = item.getByTestId('conversation-delete')
    await delBtn.waitFor({ state: 'visible' })
    await delBtn.click()
    await item.getByTestId('conversation-delete-confirm').click()
  }
}
