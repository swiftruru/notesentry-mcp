import { test as base, expect } from '@playwright/test'
import { launchApp, closeApp, type AppHandle } from './electronApp'
import { AppShell } from '../pages/AppShell'
import { AppearancePage } from '../pages/AppearancePage'
import { CommandPalette } from '../pages/CommandPalette'
import { ConversationsPage } from '../pages/ConversationsPage'

interface WorkerFixtures {
  appHandle: AppHandle
  /** 本 worker 的隔離資料根（供讀取 config.json 等斷言用）。 */
  dataDir: string
}

interface TestFixtures {
  shell: AppShell
  appearance: AppearancePage
  palette: CommandPalette
  conversations: ConversationsPage
}

/**
 * 自訂 test：每個 worker 啟動一個 app（較快），各 POM 以 test scope 注入。
 * 所有 POM fixture 都相依 `shell`，確保 ready()（含導覽抑制由 worker 啟動時完成）先跑。
 */
export const test = base.extend<TestFixtures, WorkerFixtures>({
  appHandle: [
    async ({}, use) => {
      const handle = await launchApp()
      await use(handle)
      await closeApp(handle)
    },
    { scope: 'worker' }
  ],

  dataDir: [async ({ appHandle }, use) => use(appHandle.dataDir), { scope: 'worker' }],

  shell: async ({ appHandle }, use) => {
    const shell = new AppShell(appHandle.page)
    await shell.ready()
    await use(shell)
    await shell.resetToDashboard()
  },

  appearance: async ({ shell }, use) => use(new AppearancePage(shell.page)),
  palette: async ({ shell }, use) => use(new CommandPalette(shell.page)),
  conversations: async ({ shell }, use) => use(new ConversationsPage(shell.page))
})

export { expect }
