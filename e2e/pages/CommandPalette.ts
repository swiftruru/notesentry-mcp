import { type Page, type Locator, expect } from '@playwright/test'

/** ⌘K 命令面板。 */
export class CommandPalette {
  constructor(readonly page: Page) {}

  private root(): Locator {
    return this.page.getByTestId('command-palette')
  }
  private input(): Locator {
    return this.page.getByTestId('command-input')
  }
  item(id: string): Locator {
    return this.page.getByTestId(`command-item-${id}`)
  }

  /** 以滑鼠開啟（點標題列觸發鈕）。 */
  async open(): Promise<void> {
    await this.page.getByTestId('command-button').click()
    await expect(this.root()).toBeVisible()
  }

  /** 以鍵盤開啟（⌘K / Ctrl+K）。 */
  async openByKeyboard(): Promise<void> {
    await this.page.keyboard.press('ControlOrMeta+k')
    await expect(this.root()).toBeVisible()
  }

  async filter(text: string): Promise<void> {
    await this.input().fill(text)
  }

  /** 過濾並執行某指令。 */
  async run(id: string, filter?: string): Promise<void> {
    if (filter != null) await this.filter(filter)
    await this.item(id).click()
    await expect(this.root()).toBeHidden()
  }
}
