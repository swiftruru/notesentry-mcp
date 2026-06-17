import { type Page, type Locator, expect } from '@playwright/test'

type FontScale = 'sm' | 'md' | 'lg' | 'xl'

/** 設定 →「外觀」分頁：字級分段控制 + 高對比開關。 */
export class AppearancePage {
  constructor(readonly page: Page) {}

  private fontBtn(scale: FontScale): Locator {
    return this.page.getByTestId(`appearance-font-${scale}`)
  }
  private hcSwitch(): Locator {
    return this.page.getByTestId('appearance-hc-switch')
  }

  /** 進入設定並切到外觀分頁。 */
  async open(): Promise<void> {
    await this.page.getByTestId('rail-item-settings').click()
    await this.page.getByTestId('settings-tab-appearance').click()
    await expect(this.fontBtn('md')).toBeVisible()
  }

  async setFontScale(scale: FontScale): Promise<void> {
    await this.fontBtn(scale).click()
    await expect(this.fontBtn(scale)).toHaveAttribute('aria-pressed', 'true')
  }

  async toggleHighContrast(): Promise<void> {
    await this.hcSwitch().click()
  }

  async expectHighContrast(on: boolean): Promise<void> {
    await expect(this.hcSwitch()).toHaveAttribute('aria-checked', String(on))
    await expect
      .poll(() => this.page.evaluate(() => document.documentElement.classList.contains('high-contrast')))
      .toBe(on)
  }
}
