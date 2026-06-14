// 開發模式身分修正（macOS）
//
// 在 `npm run dev` 下,macOS 的 Dock 名稱、選單列粗體名稱、以及「關於」面板的圖示,
// 都是直接讀「正在執行的 Electron.app bundle」——app.setName()/setAboutPanelOptions
// 的 iconPath 在 macOS 改不動它們。
// 解法:每次 dev 啟動前,直接把本專案 node_modules 內 Electron.app 的:
//   1. Info.plist 的 CFBundleName / CFBundleDisplayName 改成 App 名稱
//   2. Contents/Resources/electron.icns 換成我們的圖示(由 build/icon.png 生成)
// 重新安裝會還原,但本腳本綁在 predev/postinstall,會自我修復。
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, copyFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const APP_NAME = 'NoteSentry'

if (process.platform !== 'darwin') process.exit(0)

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const appBundle = join(root, 'node_modules/electron/dist/Electron.app')
const plist = join(appBundle, 'Contents/Info.plist')

if (!existsSync(plist)) {
  console.warn('[patch-dev] 找不到 Electron 的 Info.plist,略過。')
  process.exit(0)
}

// --- 1. 名稱 ---
const PB = '/usr/libexec/PlistBuddy'
function setKey(key, val) {
  try {
    execFileSync(PB, ['-c', `Set :${key} ${val}`, plist], { stdio: 'pipe' })
  } catch {
    try {
      execFileSync(PB, ['-c', `Add :${key} string ${val}`, plist], { stdio: 'pipe' })
    } catch (e) {
      console.warn(`[patch-dev] 設定 ${key} 失敗:`, e.message)
    }
  }
}
setKey('CFBundleName', APP_NAME)
setKey('CFBundleDisplayName', APP_NAME)

// --- 2. 圖示（生成 icns 並換掉 bundle 的 electron.icns）---
function buildIcns(srcPng, outIcns) {
  // 若已是最新就跳過（icns 比來源 png 新）。
  if (existsSync(outIcns) && statSync(outIcns).mtimeMs >= statSync(srcPng).mtimeMs) return true
  const set = join(mkdtempSync(join(tmpdir(), 'ns-icon-')), 'icon.iconset')
  mkdirSync(set, { recursive: true })
  const sizes = [
    [16, '16x16'], [32, '16x16@2x'], [32, '32x32'], [64, '32x32@2x'],
    [128, '128x128'], [256, '128x128@2x'], [256, '256x256'], [512, '256x256@2x'],
    [512, '512x512'], [1024, '512x512@2x']
  ]
  for (const [px, name] of sizes) {
    execFileSync('sips', ['-z', String(px), String(px), srcPng, '--out', join(set, `icon_${name}.png`)], { stdio: 'pipe' })
  }
  execFileSync('iconutil', ['-c', 'icns', set, '-o', outIcns], { stdio: 'pipe' })
  return true
}

const iconPng = join(root, 'build/icon.png')
const builtIcns = join(root, 'build/icon.icns')
if (existsSync(iconPng)) {
  try {
    buildIcns(iconPng, builtIcns)
    copyFileSync(builtIcns, join(appBundle, 'Contents/Resources/electron.icns'))
    console.log('[patch-dev] 已換掉 Electron dev bundle 圖示（關於面板/Dock/App switcher）')
  } catch (e) {
    console.warn('[patch-dev] 換圖失敗:', e.message)
  }
}

// --- 觸碰 bundle + 請 LaunchServices 重新註冊,讓變更更可靠地生效 ---
try {
  execFileSync('touch', [appBundle])
} catch {
  /* 非致命 */
}
try {
  const lsregister =
    '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
  if (existsSync(lsregister)) execFileSync(lsregister, ['-f', appBundle], { stdio: 'pipe' })
} catch {
  /* 非致命 */
}

console.log(`[patch-dev] Electron dev bundle 身分 → ${APP_NAME}`)
