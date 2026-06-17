import { app } from 'electron'
import { resolve, isAbsolute } from 'node:path'

/**
 * 路徑解析（開發 vs 打包後一致正確）。
 *
 * - 「資料根」(getDataRoot)：放使用者產生、含臨床文本的檔案——config.json、logs/、
 *   conversations/、預設 DB。打包後用 app.getPath('userData')（OS 使用者資料夾，仍在
 *   本機、符合 DUA「不離開本機」）；開發時用專案根 cwd（方便直接檢視）。
 * - 「資源根」(getResourceRoot)：放隨 App 內附、唯讀的資源——Python MCP server 腳本。
 *   打包後用 process.resourcesPath（.app/Contents/Resources）；開發時用專案根 cwd。
 *
 * 皆為「延遲求值」（函式而非常數）：app 名稱在 index.ts 模組頂端才 setName，userData
 * 取得時機必須晚於 setName，故不可在模組載入時就算好。
 */

/** 含臨床文本/設定/日誌的資料根。 */
export function getDataRoot(): string {
  // 測試/自動化用：明確指定資料根，隔離 config/對話/日誌到暫存資料夾，
  // 避免污染專案根或 userData（沿用 NS_EXPORT_TEST_DIR 的同款思路）。
  const override = process.env.NS_DATA_DIR
  if (override) return override
  return app.isPackaged ? app.getPath('userData') : process.cwd()
}

/** 內附唯讀資源（Python server 等）的根目錄。 */
export function getResourceRoot(): string {
  return app.isPackaged ? process.resourcesPath : process.cwd()
}

/** 相對路徑 → 相對於「資料根」的絕對路徑（DB、設定、日誌、對話）。 */
export function resolveDataPath(p: string): string {
  if (!p) return p
  return isAbsolute(p) ? p : resolve(getDataRoot(), p)
}

/** 相對路徑 → 相對於「資源根」的絕對路徑（內附 Python server 腳本）。 */
export function resolveResourcePath(p: string): string {
  if (!p) return p
  return isAbsolute(p) ? p : resolve(getResourceRoot(), p)
}
