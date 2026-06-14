import { app, shell, BrowserWindow, Menu, nativeImage } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { join } from 'node:path'
import { registerIpc, abortAllSessions } from './ipc'
import { connectMcp, disconnectMcp } from './mcp/mcpClient'
import { loadConfig } from './config/configStore'
import appIconPath from '../../resources/icon.png?asset'

const APP_NAME = 'NoteSentry'
// 越早設越好：影響 app.getName()、dialog、userData 等（dev 的 dock/menu 粗體名仍受系統 bundle 限制）。
app.setName(APP_NAME)

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#EAF3F3',
    title: APP_NAME,
    icon: appIconPath,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // 安全：渲染端不得直接碰 Node / 子行程 / 網路。
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // 攔截所有外開連結與導航，避免渲染端意外連到外部網站。
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  // 載入渲染端。
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** 設定 App 名稱、關於面板、Dock 圖示與應用程式選單。 */
function setupAppIdentity(): void {
  const isMac = process.platform === 'darwin'

  // 關於面板（macOS「關於 NoteSentry」）內容。
  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: '© 2026 YU-RU, PAN · 資料決策分析實驗室',
    credits: '國立臺北護理健康大學 資訊管理系所',
    iconPath: appIconPath
  })

  // Dock 圖示（macOS；dev 下會把預設 Electron 圖示換成自訂圖示）。
  if (isMac && app.dock) {
    try {
      app.dock.setIcon(nativeImage.createFromPath(appIconPath))
    } catch (err) {
      console.error('[main] 設定 Dock 圖示失敗：', err)
    }
  }

  // 應用程式選單：mac 的 app 選單與必要的 Edit/View/Window（含 NoteSentry 標籤）。
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: APP_NAME,
            submenu: [
              { role: 'about', label: `關於 ${APP_NAME}` },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide', label: `隱藏 ${APP_NAME}` },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit', label: `結束 ${APP_NAME}` }
            ]
          }
        ] as MenuItemConstructorOptions[])
      : []),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  loadConfig()
  setupAppIdentity()
  registerIpc(() => mainWindow)
  createWindow()

  // 啟動時嘗試連上 MCP server（失敗不致命，狀態會回報到 UI）。
  connectMcp().catch((err) => console.error('[main] 初次 MCP 連線失敗：', err))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  abortAllSessions()
  await disconnectMcp()
})

// 額外保險：阻擋任何 webview 附加與外部協定開啟。
app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
})

// 確保開啟外部連結時走系統瀏覽器而非 app 內導航（目前不主動使用）。
export function openExternal(url: string): void {
  shell.openExternal(url)
}
