import { test as base, expect } from '@playwright/test'
import { launchApp, closeApp, type AppHandle } from './electronApp'
import { AppShell } from '../pages/AppShell'

/** 視覺回歸用：固定主題/語言/字級/視窗大小，最大化截圖決定性。 */
const SEED_CONFIG = {
  theme: 'light',
  language: 'zh-TW',
  fontScale: 'md',
  highContrast: false,
  windowBounds: { width: 1280, height: 860, x: 60, y: 60, maximized: false }
}

export const test = base.extend<{ shell: AppShell }, { visualApp: AppHandle }>({
  visualApp: [
    async ({}, use) => {
      const handle = await launchApp({ seedConfig: SEED_CONFIG })
      await use(handle)
      await closeApp(handle)
    },
    { scope: 'worker' }
  ],

  shell: async ({ visualApp }, use) => {
    const shell = new AppShell(visualApp.page)
    await shell.ready()
    await use(shell)
    await shell.resetToDashboard()
  }
})

export { expect }
