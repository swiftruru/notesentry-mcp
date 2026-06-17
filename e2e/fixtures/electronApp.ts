import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/** 打包後主程式進入點（pretest 會先 `npm run build` 產生 out/）。 */
const MAIN_ENTRY = resolve(__dirname, '../../out/main/index.js')

export interface AppHandle {
  app: ElectronApplication
  page: Page
  /** 本次執行的隔離資料根（config/對話/日誌都在這；測試結束會刪）。 */
  dataDir: string
  /** 匯出測試落檔資料夾（NS_EXPORT_TEST_DIR；繞過原生存檔對話框）。 */
  exportDir: string
}

export interface LaunchOptions {
  /** 啟動前寫入 dataDir/config.json 的部分設定（configStore 會載入並補預設）。 */
  seedConfig?: Record<string, unknown>
}

/**
 * 啟動隔離的 NoteSentry 實例：
 * - 移除 ELECTRON_RUN_AS_NODE（dev shell 常設 =1，會讓 electron 當純 Node 跑、app undefined）。
 * - 設 NS_DATA_DIR 指向暫存資料夾，乾淨隔離、不污染專案根 config.json。
 * - CI（Linux runner 以 root 跑）需 --no-sandbox 才能啟動 Electron。
 * - 可選 seedConfig：先寫入 config.json 給需要特定設定的測試（live/visual）。
 * - 抑制首啟自動導覽（設 localStorage 旗標並關掉已開啟的導覽遮罩）。
 */
export async function launchApp(opts: LaunchOptions = {}): Promise<AppHandle> {
  const dataDir = await mkdtemp(join(tmpdir(), 'ns-e2e-'))
  if (opts.seedConfig) {
    await writeFile(join(dataDir, 'config.json'), JSON.stringify(opts.seedConfig, null, 2), 'utf-8')
  }
  // 匯出測試落檔資料夾：設 NS_EXPORT_TEST_DIR 讓匯出繞過原生存檔對話框（沿用 export.ts 的鉤子）。
  const exportDir = join(dataDir, 'exports')
  await mkdir(exportDir, { recursive: true })

  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v != null) env[k] = v
  delete env.ELECTRON_RUN_AS_NODE
  env.NS_DATA_DIR = dataDir
  env.NS_EXPORT_TEST_DIR = exportDir

  const args = [MAIN_ENTRY]
  if (process.env.CI) args.push('--no-sandbox')

  const app = await electron.launch({ args, env })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.getByTestId('rail-item-dashboard').waitFor({ state: 'visible', timeout: 20_000 })

  await suppressTour(page)
  return { app, page, dataDir, exportDir }
}

/** 關閉 app 並清掉暫存資料根。 */
export async function closeApp(handle: AppHandle): Promise<void> {
  await handle.app.close()
  await rm(handle.dataDir, { recursive: true, force: true })
}

/**
 * 首啟導覽會在載入約 700ms 後自動彈出、其全螢幕遮罩會吃掉點擊。
 * 這裡設下 ns.tourSeen 旗標（避免之後 reload 再次自動開），並把已彈出的導覽關掉。
 */
async function suppressTour(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.setItem('ns.tourSeen', '1'))
  const overlay = page.getByTestId('tour-overlay')
  try {
    await overlay.waitFor({ state: 'visible', timeout: 2500 })
    await page.getByTestId('tour-end').click()
    await overlay.waitFor({ state: 'hidden', timeout: 3000 })
  } catch {
    // 導覽沒彈出（例如同一 worker 的後續測試），略過即可。
  }
}
