import { type Page, type Locator, expect } from '@playwright/test'

/** 應用外殼：導覽列切換 view、開關命令面板、每測重置。 */
export class AppShell {
  constructor(readonly page: Page) {}

  railItem(view: string): Locator {
    return this.page.getByTestId(`rail-item-${view}`)
  }

  /** 每個測試開始：確認 app 就緒。 */
  async ready(): Promise<void> {
    await this.railItem('dashboard').waitFor({ state: 'visible' })
  }

  /** 點導覽列切到指定 view，並斷言成為作用中。 */
  async goto(view: string): Promise<void> {
    await this.railItem(view).click()
    await expect(this.railItem(view)).toHaveAttribute('aria-current', 'page')
  }

  /** 每個測試結束：關掉浮層、回到儀表板，避免污染下一個測試（同 worker 共用 app）。 */
  async resetToDashboard(): Promise<void> {
    await this.page.keyboard.press('Escape')
    await this.railItem('dashboard').click()
    await expect(this.railItem('dashboard')).toHaveAttribute('aria-current', 'page')
  }
}
