import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, chromium, type Page } from '@playwright/test'
import { launchApp, closeApp } from '../fixtures/electronApp'
import { AppShell } from '../pages/AppShell'
import { DEFAULT_CONFIG } from '../../src/shared/types'

/**
 * 文件用截圖擷取（@capture，本機 opt-in）。
 * 啟動真實 app（light/zh-TW/大視窗、啟用 MCP、絕對 DB 路徑、本機 Ollama），跑數段觸發各支柱工具的對話
 * 以養出真實稽核資料，逐頁截圖到 docs/screenshots-1/，並把匯出的治理/個案報表 HTML 用 chromium 整頁截圖。
 * 偵測不到 Ollama 模型或 mimic_notes.db 即跳過。
 */
const OLLAMA = 'http://localhost:11434'
const DB = resolve(__dirname, '../../mimic_notes.db')
const OUT = resolve(__dirname, '../../docs/screenshots-1')

async function detectModel(): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA}/api/tags`)
    if (!res.ok) return null
    const data = (await res.json()) as { models?: { name?: string; model?: string }[] }
    const names = (data.models ?? []).map((m) => m.name ?? m.model).filter((n): n is string => !!n)
    if (!names.length) return null
    // 偏好可靠呼叫工具的小模型（截圖務求每段都觸發 HITL）；否則用預設、再否則清單第一個。
    const prefer = ['qwen2.5:latest', 'qwen2.5', DEFAULT_CONFIG.model]
    return prefer.find((p) => names.includes(p)) ?? names[0]
  } catch {
    return null
  }
}

test('capture system screenshots @capture', async () => {
  const model = await detectModel()
  test.skip(!model || !existsSync(DB), 'Ollama 模型或 mimic_notes.db 不可用')
  test.setTimeout(600_000)
  mkdirSync(OUT, { recursive: true })

  process.env.NS_EXPORT_FORMAT = 'html'
  const handle = await launchApp({
    seedConfig: {
      ...DEFAULT_CONFIG,
      model,
      dbPath: DB,
      theme: 'light',
      language: 'zh-TW',
      fontScale: 'md',
      highContrast: false,
      windowBounds: { width: 1360, height: 1000, x: 40, y: 40, maximized: false }
    }
  })
  const page = handle.page
  const shell = new AppShell(page)
  await shell.ready()

  const shot = (name: string): Promise<Buffer> => page.screenshot({ path: resolve(OUT, name) })

  // 等模型把工具呼叫跑完：逐次核可 HITL，直到出現助理訊息且無待核可。
  async function settleChat(): Promise<void> {
    const deadline = Date.now() + 220_000
    while (Date.now() < deadline) {
      if (await page.getByTestId('hitl-dialog').isVisible().catch(() => false)) {
        await page.getByTestId('hitl-approve').click().catch(() => {})
        await page.getByTestId('hitl-dialog').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
        continue
      }
      const done =
        (await page.getByTestId('chat-streaming').count()) === 0 &&
        (await page.getByTestId('message-assistant').count()) > 0
      await page.waitForTimeout(700)
      if (done && !(await page.getByTestId('hitl-dialog').isVisible().catch(() => false))) break
    }
  }

  async function newChat(): Promise<void> {
    // ⌘N / Ctrl+N 開新對話（不受目前 view / 側欄收合影響；在對話頁點 rail 對話鈕會收合側欄）。
    await page.keyboard.press('ControlOrMeta+n')
    await page.getByTestId('composer-input').waitFor({ state: 'visible', timeout: 10_000 })
    await page.waitForTimeout(200)
  }

  async function ask(prompt: string, opts: { hitlShot?: string } = {}): Promise<void> {
    await newChat()
    await page.getByTestId('composer-input').fill(prompt)
    await page.getByTestId('composer-send').click()
    if (opts.hitlShot) {
      await page.getByTestId('hitl-dialog').waitFor({ state: 'visible', timeout: 120_000 })
      await page.waitForTimeout(300)
      await shot(opts.hitlShot)
    }
    await settleChat()
    await page.waitForTimeout(600)
  }

  // --- 對話空狀態（起手範例）---
  await newChat()
  await page.waitForTimeout(400)
  await shot('03-chat-empty.png')

  // --- 對話 #1（mimic/HIS）：同時截 HITL 與完整問答 ---
  await ask('請用工具查詢 subject_id 10006 的病歷重點，並計算其紀錄筆數。', { hitlShot: '05-hitl-approval.png' })
  await shot('04-chat-conversation.png')

  // --- 養其餘三支柱的稽核資料 ---
  await ask('請用工具判讀這組成人生命徵象並標出危急紅旗：體溫 38.5、心跳 122、呼吸 24、SpO2 92、收縮壓 95、GCS 14。')
  await ask('請用工具檢查這份藥物清單是否有交互作用：warfarin、aspirin、ibuprofen。')
  await ask('請用工具把這組生命徵象轉成 HL7 FHIR R4 Observation：體溫 37.5、心跳 110、SpO2 95、收縮壓 140、舒張壓 90。')
  await shot('10-apps-fhir-result.png') // 最後一段即 FHIR 轉換結果

  // --- 應用四表單（載入範例後截圖）---
  await shell.goto('apps')
  for (const [key, n] of [
    ['triage', '06-apps-triage.png'],
    ['soap', '07-apps-soap.png'],
    ['pharmacy', '08-apps-pharmacy.png'],
    ['fhir', '09-apps-fhir.png']
  ] as const) {
    await page.getByTestId(`apps-tab-${key}`).click()
    await page.getByTestId('apps-load-sample').click()
    await page.waitForTimeout(300)
    await shot(n)
  }

  // --- 工具與資料字典 ---
  await shell.goto('tools')
  await page.getByTestId('tools-tab-catalog').click()
  await page.waitForTimeout(300)
  await shot('11-tools-catalog.png')
  await page.getByTestId('tools-tab-schema').click()
  await page.waitForTimeout(300)
  await shot('12-tools-schema.png')

  // --- 稽核日誌（列表＋展開） ---
  await shell.goto('audit')
  await page.waitForTimeout(300)
  await shot('13-audit-log.png')
  await page.locator('button[aria-expanded]').first().click().catch(() => {})
  await page.waitForTimeout(300)
  await shot('14-audit-detail.png')

  // --- 設定 5 分頁 ---
  await shell.goto('settings')
  await page.getByTestId('settings-tab-inference').click()
  await page.getByTestId('settings-test').click()
  await page.getByTestId('settings-test-ollama').waitFor({ state: 'visible', timeout: 60_000 }).catch(() => {})
  await page.waitForTimeout(800)
  await shot('15-settings-inference.png')
  await page.getByTestId('settings-tab-mcp').click()
  await page.waitForTimeout(400)
  await shot('16-settings-mcp.png')
  await page.getByTestId('settings-tab-agent').click()
  await page.waitForTimeout(1200)
  await shot('17-settings-agent.png')
  await page.getByTestId('settings-tab-appearance').click()
  await page.waitForTimeout(300)
  await shot('18-settings-appearance.png')

  // --- 命令面板 ---
  await page.getByTestId('command-button').click()
  await page.waitForTimeout(300)
  await shot('19-command-palette.png')
  await page.keyboard.press('Escape')

  // --- 特色導覽 ---
  await page.getByTestId('command-button').click()
  await page.getByTestId('command-input').fill('導覽')
  await page.getByTestId('command-item-startTour').click()
  await page.getByTestId('tour-overlay').waitFor({ state: 'visible', timeout: 5000 })
  await page.waitForTimeout(500)
  await shot('20-feature-tour.png')
  await page.getByTestId('tour-end').click()

  // --- 說明 / 關於 ---
  await shell.goto('help')
  await page.waitForTimeout(300)
  await shot('21-help-architecture.png')
  await shell.goto('about')
  await page.waitForTimeout(300)
  await shot('22-about.png')

  // --- 儀表板（已有資料）＋ 健康狀態下拉 ---
  await shell.goto('dashboard')
  await page.waitForTimeout(500)
  await shot('01-home-dashboard.png')
  await page.getByTestId('health-status').locator('button').first().click()
  await page.waitForTimeout(400)
  await shot('02-health-status.png')
  await page.keyboard.press('Escape')

  // --- 英文 UI（展示 i18n）＋ 高對比（展示無障礙）---
  await page.getByTestId('lang-toggle').click()
  await page.waitForTimeout(400)
  await shot('25-english-ui.png')
  await page.getByTestId('lang-toggle').click() // 切回中文
  await page.waitForTimeout(300)

  // --- 匯出報表並用 chromium 渲染 HTML 截圖 ---
  // 治理稽核報表
  await shell.goto('audit')
  await page.getByTestId('audit-report').click()
  await page.waitForTimeout(1500)
  // 個案報告（開啟最近一段對話後匯出）
  await page.getByTestId('rail-item-chat').click()
  await page.getByTestId('conversation-list').waitFor({ state: 'visible' }).catch(() => {})
  await page.locator('[data-testid^="conversation-item-"] [data-testid="conversation-open"]').first().click().catch(() => {})
  await page.waitForTimeout(500)
  await page.getByTestId('chat-report').click().catch(() => {})
  await page.waitForTimeout(1500)

  const gov = readdirSync(handle.exportDir).find((f) => f.startsWith('notesentry-governance-') && f.endsWith('.html'))
  const cas = readdirSync(handle.exportDir).find((f) => /-report-\d+\.html$/.test(f))
  const browser = await chromium.launch()
  const renderHtml = async (file: string | undefined, name: string): Promise<void> => {
    if (!file) return
    const pg: Page = await browser.newPage({ viewport: { width: 1100, height: 1400 } })
    await pg.goto('file://' + resolve(handle.exportDir, file))
    await pg.screenshot({ path: resolve(OUT, name), fullPage: true })
    await pg.close()
  }
  await renderHtml(gov, '23-governance-report.png')
  await renderHtml(cas, '24-case-report.png')
  await browser.close()

  await closeApp(handle)
})
