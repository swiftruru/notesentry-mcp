import { dialog, BrowserWindow, app } from 'electron'
import { writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { Marked } from 'marked'
import hljs from 'highlight.js/lib/core'
import hljsJson from 'highlight.js/lib/languages/json'
import { AuditEntry, Conversation, ExportResult, ToolInfo } from '@shared/types'

hljs.registerLanguage('json', hljsJson)
import { loadConfig, saveConfig } from './config/configStore'
import { listAudit } from './audit/auditLog'
import { getTools } from './mcp/mcpClient'
import { tMain } from './i18n'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function stamp(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

/** 把對話轉成排版好的 Markdown。 */
export function conversationToMarkdown(conv: Conversation): string {
  const out: string[] = []
  out.push(`# ${conv.title || tMain('main.export.defaultTitle')}`, '')
  out.push(`> ${tMain('main.export.header')}`)
  out.push(`> ${tMain('main.export.exportedAt', { time: stamp(Date.now()) })}`)
  if (conv.model) out.push(`> ${tMain('main.export.model', { model: conv.model })}`)
  out.push(`> ${tMain('main.export.messageCount', { count: conv.messages.length })}`, '', '---', '')

  for (const m of conv.messages) {
    if (m.role === 'user') {
      out.push(`## ${tMain('main.export.user')}`, '', m.content.trim(), '')
    } else if (m.role === 'assistant') {
      out.push(`## ${tMain('main.export.assistant')}`, '')
      if (m.content.trim()) out.push(m.content.trim(), '')
      for (const tc of m.toolCalls ?? []) {
        out.push(
          `**${tMain('main.export.toolCall', { name: tc.name })}**`,
          '',
          '```json',
          JSON.stringify(tc.args ?? {}, null, 2),
          '```',
          ''
        )
      }
    } else if (m.role === 'tool') {
      out.push(`### ${tMain('main.export.toolResult')}`, '', '```', m.content.trim(), '```', '')
    } else if (m.role === 'system') {
      out.push(`> ⚠️ ${m.content.trim()}`, '')
    }
  }

  out.push('---', '', `_${tMain('main.export.footer')}_`, '')
  return out.join('\n')
}

function safeName(title: string): string {
  const fallback = tMain('main.export.defaultTitle')
  return (title || fallback).replace(/[\\/:*?"<>|\n\r]/g, '_').trim().slice(0, 60) || fallback
}

/** 匯出對話為 Markdown：跳出「另存新檔」，預設於專案 exports/。 */
export async function exportConversationMarkdown(
  conv: Conversation,
  win: BrowserWindow | null
): Promise<ExportResult> {
  try {
    const md = conversationToMarkdown(conv)
    const d = new Date()
    const fname = `${safeName(conv.title)}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
      d.getDate()
    )}.md`

    // 測試用無頭路徑（設了 NS_EXPORT_TEST_DIR 就直接寫，不跳對話框）。
    const testDir = process.env.NS_EXPORT_TEST_DIR
    if (testDir) {
      const p = join(testDir, fname)
      writeFileSync(p, md, 'utf-8')
      return { saved: true, path: p }
    }

    // 預設起始資料夾：上次選的位置 → 否則使用者的「文件」資料夾（使用者仍可在對話框自由選任何位置）。
    const cfg = loadConfig()
    const remembered = cfg.lastExportDir && existsSync(cfg.lastExportDir) ? cfg.lastExportDir : null
    const startDir = remembered ?? app.getPath('documents')
    const defaultPath = join(startDir, fname)

    const opts = {
      title: '匯出對話為 Markdown',
      defaultPath,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'] as Array<
        'createDirectory' | 'showOverwriteConfirmation'
      >
    }
    const res = win
      ? await dialog.showSaveDialog(win, opts)
      : await dialog.showSaveDialog(opts)

    if (res.canceled || !res.filePath) return { saved: false, canceled: true }
    writeFileSync(res.filePath, md, 'utf-8')
    // 記住這次選的資料夾，下次從這裡開始。
    saveConfig({ ...loadConfig(), lastExportDir: dirname(res.filePath) })
    return { saved: true, path: res.filePath }
  } catch (err) {
    return { saved: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** 通用：把一段文字另存為檔案（給「匯出工具結果 .json」等用），沿用 lastExportDir 與測試路徑。 */
export async function saveTextFile(
  defaultName: string,
  content: string,
  win: BrowserWindow | null
): Promise<ExportResult> {
  try {
    const fname = safeName(defaultName.replace(/\.[^.]+$/, '')) + (defaultName.match(/\.[^.]+$/)?.[0] ?? '')
    const testDir = process.env.NS_EXPORT_TEST_DIR
    if (testDir) {
      const p = join(testDir, fname)
      writeFileSync(p, content, 'utf-8')
      return { saved: true, path: p }
    }
    const cfg = loadConfig()
    const remembered = cfg.lastExportDir && existsSync(cfg.lastExportDir) ? cfg.lastExportDir : null
    const startDir = remembered ?? app.getPath('documents')
    const ext = (fname.match(/\.([^.]+)$/)?.[1] ?? 'txt').toLowerCase()
    const opts = {
      defaultPath: join(startDir, fname),
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'] as Array<
        'createDirectory' | 'showOverwriteConfirmation'
      >
    }
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (res.canceled || !res.filePath) return { saved: false, canceled: true }
    writeFileSync(res.filePath, content, 'utf-8')
    saveConfig({ ...loadConfig(), lastExportDir: dirname(res.filePath) })
    return { saved: true, path: res.filePath }
  } catch (err) {
    return { saved: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** 匯出稽核紀錄為 JSONL（每行一筆）：跳出「另存新檔」，沿用 lastExportDir 與測試路徑。 */
export async function exportAuditJsonl(
  entries: AuditEntry[],
  win: BrowserWindow | null
): Promise<ExportResult> {
  try {
    const jsonl = entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : '')
    const d = new Date()
    const fname = `notesentry-audit-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.jsonl`

    const testDir = process.env.NS_EXPORT_TEST_DIR
    if (testDir) {
      const p = join(testDir, fname)
      writeFileSync(p, jsonl, 'utf-8')
      return { saved: true, path: p }
    }

    const cfg = loadConfig()
    const remembered = cfg.lastExportDir && existsSync(cfg.lastExportDir) ? cfg.lastExportDir : null
    const startDir = remembered ?? app.getPath('documents')
    const opts = {
      title: tMain('main.export.auditTitle'),
      defaultPath: join(startDir, fname),
      filters: [{ name: 'JSON Lines', extensions: ['jsonl'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'] as Array<
        'createDirectory' | 'showOverwriteConfirmation'
      >
    }
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (res.canceled || !res.filePath) return { saved: false, canceled: true }
    writeFileSync(res.filePath, jsonl, 'utf-8')
    saveConfig({ ...loadConfig(), lastExportDir: dirname(res.filePath) })
    return { saved: true, path: res.filePath }
  } catch (err) {
    return { saved: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ---- 個案報告 ----

/** Markdown 表格儲存格安全化（跳脫 | 與換行）。 */
function cell(v: unknown): string {
  return String(v ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, ' ')
    .trim()
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

/** 工具結果若為 FHIR Bundle → 渲染成 Observation 表（否則 null）。 */
function fhirBundleToTable(text: string): string | null {
  let obj: { bundle?: unknown; resourceType?: string }
  try {
    obj = JSON.parse(text)
  } catch {
    return null
  }
  const b = (obj?.bundle ?? obj) as {
    resourceType?: string
    entry?: { resource?: Record<string, never> }[]
  }
  if (!b || b.resourceType !== 'Bundle' || !Array.isArray(b.entry)) return null
  const rows: string[] = []
  for (const e of b.entry) {
    const r = e?.resource as Record<string, unknown> | undefined
    if (!r) continue
    const code = (r.code ?? {}) as { text?: string; coding?: { code?: string; display?: string }[] }
    const name = code.text || code.coding?.[0]?.display || 'Observation'
    const loinc = code.coding?.[0]?.code ?? ''
    const vq = r.valueQuantity as { value?: number; unit?: string; code?: string } | undefined
    const comp = r.component as
      | { code?: { coding?: { code?: string; display?: string }[] }; valueQuantity?: { value?: number; unit?: string; code?: string } }[]
      | undefined
    if (vq) {
      rows.push(`| ${cell(name)} | ${cell(vq.value)} | ${cell(vq.unit)} | ${cell(loinc)} | ${cell(vq.code)} |`)
    } else if (Array.isArray(comp)) {
      for (const c of comp) {
        const cn = c.code?.coding?.[0]?.display || name
        const cl = c.code?.coding?.[0]?.code ?? loinc
        rows.push(
          `| ${cell(cn)} | ${cell(c.valueQuantity?.value)} | ${cell(c.valueQuantity?.unit)} | ${cell(cl)} | ${cell(c.valueQuantity?.code)} |`
        )
      }
    } else {
      rows.push(`| ${cell(name)} |  |  | ${cell(loinc)} |  |`)
    }
  }
  if (!rows.length) return null
  return [
    `**${tMain('main.report.fhirTitle')}**`,
    '',
    tMain('main.report.fhirCols'),
    '| --- | --- | --- | --- | --- |',
    ...rows,
    ''
  ].join('\n')
}

/** 工具結果若為用藥（interactions/conflicts）→ 渲染成表（否則 null）。 */
function pharmacyToTable(text: string): string | null {
  let obj: {
    interactions?: { drug_a?: string; drug_b?: string; severity?: string; mechanism?: string; recommendation?: string }[]
    conflicts?: { allergy?: string; conflicting_drug?: string; drug_class?: string; recommendation?: string }[]
  }
  try {
    obj = JSON.parse(text)
  } catch {
    return null
  }
  const out: string[] = []
  if (Array.isArray(obj?.interactions) && obj.interactions.length) {
    out.push(
      `**${tMain('main.report.pharmacyInteractions')}**`,
      '',
      tMain('main.report.pharmacyIntCols'),
      '| --- | --- | --- | --- |'
    )
    for (const it of obj.interactions) {
      const mech = [it.mechanism, it.recommendation].filter(Boolean).join('；')
      out.push(`| ${cell(it.drug_a)} | ${cell(it.drug_b)} | ${cell(it.severity)} | ${cell(mech)} |`)
    }
    out.push('')
  }
  if (Array.isArray(obj?.conflicts) && obj.conflicts.length) {
    out.push(
      `**${tMain('main.report.pharmacyConflicts')}**`,
      '',
      tMain('main.report.pharmacyConfCols'),
      '| --- | --- | --- | --- |'
    )
    for (const c of obj.conflicts) {
      out.push(`| ${cell(c.allergy)} | ${cell(c.conflicting_drug)} | ${cell(c.drug_class)} | ${cell(c.recommendation)} |`)
    }
    out.push('')
  }
  return out.length ? out.join('\n') : null
}

/** 把一段對話確定性地組裝成結構化個案報告（Markdown）；不額外呼叫 LLM。 */
export function conversationToCaseReport(conv: Conversation): string {
  const out: string[] = []
  const title = conv.title || tMain('main.report.defaultTitle')
  out.push(`# ${tMain('main.report.title', { title })}`, '')
  out.push(`> ${tMain('main.report.govNote')}`)
  out.push(`> ${tMain('main.report.generatedAt', { time: stamp(Date.now()) })}`)
  if (conv.model) out.push(`> ${tMain('main.report.model', { model: conv.model })}`)
  out.push(`> ${tMain('main.report.messages', { count: conv.messages.length })}`, '', '---', '')

  const msgs = conv.messages
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]
    if (m.role === 'user') {
      out.push(`## ${tMain('main.report.sectionInput')}`, '', m.content.trim(), '')
    } else if (m.role === 'assistant') {
      if (m.content.trim()) {
        out.push(`## ${tMain('main.report.sectionAssessment')}`, '', m.content.trim(), '')
      }
      const calls = m.toolCalls ?? []
      if (calls.length) {
        // 此 assistant 之後連續的 tool 訊息，依序對應各 toolCall。
        const results: string[] = []
        let j = i + 1
        while (j < msgs.length && msgs[j].role === 'tool') {
          results.push(msgs[j].content)
          j++
        }
        out.push(`### ${tMain('main.report.sectionTools')}`, '')
        calls.forEach((tc, k) => {
          out.push(`**${tMain('main.report.toolLabel', { name: tc.name })}**`, '')
          out.push('```json', JSON.stringify(tc.args ?? {}, null, 2), '```', '')
          const res = results[k]
          if (res) {
            const table = fhirBundleToTable(res) ?? pharmacyToTable(res)
            if (table) out.push(table, '')
            else out.push('```', truncate(res.trim(), 1500), '```', '')
          }
        })
      }
    }
  }

  // 稽核軌跡（人機協作）：以 sessionId 對應此對話的真實核可紀錄。
  out.push(`## ${tMain('main.report.sectionAudit')}`, '')
  const audit = listAudit().filter((e) => e.sessionId === conv.id)
  if (audit.length) {
    out.push(tMain('main.report.auditCols'), '| --- | --- | --- | --- |')
    let approved = 0
    let rejected = 0
    for (const e of audit) {
      if (e.approved) approved++
      else rejected++
      const status = e.approved ? tMain('main.report.approved') : tMain('main.report.rejected')
      const summary = cell(truncate(e.error ? e.error : e.resultSummary ?? '', 120))
      out.push(`| ${cell(e.toolName)} | ${status} | ${stamp(e.ts)} | ${summary} |`)
    }
    out.push('', tMain('main.report.auditTotals', { total: audit.length, approved, rejected }), '')
  } else {
    out.push(tMain('main.report.auditEmpty'), '')
  }

  out.push('---', '', `_${tMain('main.report.footer')}_`, '')
  return out.join('\n')
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 輕量移除危險 HTML（報告為使用者自有資料、本機開啟；此為基本防護，非完整 sanitizer）。 */
function stripUnsafeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '$1="#"')
}

const REPORT_CSS = `
:root{--brand:#0d5c63;--brand2:#247b7b;--ink:#1c2b2d;--muted:#5a6b6d;--border:#d4e4e4;--card:#eaf3f3}
*{box-sizing:border-box}
body{margin:0;background:#eef5f5;color:var(--ink);line-height:1.7;
  font-family:-apple-system,"Segoe UI",system-ui,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif}
.report{max-width:820px;margin:24px auto;background:#fff;border:1px solid var(--border);border-radius:12px;padding:32px 40px}
.report>:first-child{margin-top:0}
h1{color:var(--brand);font-size:1.55rem;margin:0 0 .5rem}
h2{color:var(--brand);font-size:1.2rem;margin:1.7rem 0 .5rem;border-bottom:1px solid var(--border);padding-bottom:.3rem}
h3{color:var(--brand2);font-size:1rem;margin:1.2rem 0 .4rem}
blockquote{margin:.5rem 0;padding:.5rem .9rem;border-left:3px solid var(--brand2);background:var(--card);color:var(--muted);border-radius:0 6px 6px 0}
blockquote p{margin:.2rem 0}
table{border-collapse:collapse;width:100%;margin:.7rem 0;font-size:.9rem}
th,td{border:1px solid var(--border);padding:.4rem .65rem;text-align:left;vertical-align:top}
th{background:var(--card);color:var(--brand);font-weight:600}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85em}
pre{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:.8rem 1rem;overflow:auto;font-size:.82rem}
pre code{background:none;padding:0}
.hljs{color:var(--ink);background:none}
.hljs-attr,.hljs-property{color:var(--brand);font-weight:600}
.hljs-string{color:#c25e7a}
.hljs-number{color:#c77d3e}
.hljs-literal,.hljs-keyword,.hljs-built_in{color:#8a6fb0}
.hljs-punctuation{color:var(--muted)}
hr{border:0;border-top:1px solid var(--border);margin:1.6rem 0}
em{color:var(--muted)}
a{color:var(--brand2)}
@media print{body{background:#fff}.report{border:0;border-radius:0;margin:0;max-width:100%;padding:0}}
`

// 報告用 marked 實例：JSON 區塊以 highlight.js 上色（內嵌主題見 REPORT_CSS）。
const reportMarked = new Marked().use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }): string {
      if ((lang ?? '').trim().toLowerCase() === 'json') {
        try {
          return `<pre><code class="hljs language-json">${hljs.highlight(text, { language: 'json' }).value}</code></pre>\n`
        } catch {
          /* fall through to plain */
        }
      }
      return `<pre><code>${escHtml(text)}</code></pre>\n`
    }
  }
})

/** 把報告 Markdown 轉成自包含、可列印、配合品牌色的 HTML 文件。 */
export function caseReportToHtml(md: string, title: string): string {
  const body = stripUnsafeHtml(reportMarked.parse(md) as string)
  const lang = loadConfig().language ?? 'zh-TW'
  return `<!doctype html>
<html lang="${escHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(title)}</title>
<style>${REPORT_CSS}</style>
</head>
<body><main class="report">${body}</main></body>
</html>
`
}

/**
 * 匯出個案報告：跳出「另存新檔」，可選 Markdown 或 HTML（依所選副檔名決定格式）。
 * 沿用 lastExportDir 與測試路徑（測試可用 NS_EXPORT_FORMAT=html 指定格式）。
 */
export async function exportCaseReport(
  conv: Conversation,
  win: BrowserWindow | null
): Promise<ExportResult> {
  try {
    const md = conversationToCaseReport(conv)
    const title = conv.title || tMain('main.report.defaultTitle')
    const d = new Date()
    const base = `${safeName(conv.title)}-report-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
      d.getDate()
    )}`

    const testDir = process.env.NS_EXPORT_TEST_DIR
    if (testDir) {
      const html = process.env.NS_EXPORT_FORMAT === 'html'
      const p = join(testDir, `${base}.${html ? 'html' : 'md'}`)
      writeFileSync(p, html ? caseReportToHtml(md, title) : md, 'utf-8')
      return { saved: true, path: p }
    }

    const cfg = loadConfig()
    const remembered = cfg.lastExportDir && existsSync(cfg.lastExportDir) ? cfg.lastExportDir : null
    const startDir = remembered ?? app.getPath('documents')
    const opts = {
      defaultPath: join(startDir, `${base}.md`),
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'HTML', extensions: ['html'] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation'] as Array<
        'createDirectory' | 'showOverwriteConfirmation'
      >
    }
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (res.canceled || !res.filePath) return { saved: false, canceled: true }
    const isHtml = /\.html?$/i.test(res.filePath)
    writeFileSync(res.filePath, isHtml ? caseReportToHtml(md, title) : md, 'utf-8')
    saveConfig({ ...loadConfig(), lastExportDir: dirname(res.filePath) })
    return { saved: true, path: res.filePath }
  } catch (err) {
    return { saved: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ---- 治理稽核報表 ----

type ToolAgg = { calls: number; approved: number; rejected: number; errors: number }
function emptyAgg(): ToolAgg {
  return { calls: 0, approved: 0, rejected: 0, errors: 0 }
}

/** 把整份稽核日誌確定性地彙整成治理報表（Markdown）；不呼叫 LLM。 */
export function governanceReportToMarkdown(audit: AuditEntry[], tools: ToolInfo[]): string {
  const out: string[] = []
  const toolToServer = new Map(tools.map((t) => [t.name, t.serverName]))
  const serverOf = (name: string): string =>
    toolToServer.get(name) ?? tMain('main.governance.serverUnknown')

  out.push(`# ${tMain('main.governance.title')}`, '')
  out.push(`> ${tMain('main.governance.govNote')}`)
  out.push(`> ${tMain('main.governance.generatedAt', { time: stamp(Date.now()) })}`)
  if (audit.length) {
    const from = stamp(Math.min(...audit.map((e) => e.ts)))
    const to = stamp(Math.max(...audit.map((e) => e.ts)))
    out.push(`> ${tMain('main.governance.period', { from, to })}`)
  }
  out.push(`> ${tMain('main.governance.source')}`, '', '---', '')

  const total = audit.length
  const approved = audit.filter((e) => e.approved).length
  const rejected = total - approved
  const errors = audit.filter((e) => e.error).length
  const uniqueTools = new Set(audit.map((e) => e.toolName)).size
  const sessions = new Set(audit.map((e) => e.sessionId)).size
  const rate = total ? Math.round((approved / total) * 100) : 0

  out.push(`## ${tMain('main.governance.summaryTitle')}`, '')
  if (!total) {
    out.push(tMain('main.governance.empty'), '')
  } else {
    out.push(
      `- ${tMain('main.governance.kpiTotal', { n: total })}`,
      `- ${tMain('main.governance.kpiApproval', { approved, rejected, rate })}`,
      `- ${tMain('main.governance.kpiErrors', { n: errors })}`,
      `- ${tMain('main.governance.kpiTools', { n: uniqueTools })}`,
      `- ${tMain('main.governance.kpiSessions', { n: sessions })}`,
      ''
    )

    // 各工具
    const byTool = new Map<string, ToolAgg>()
    for (const e of audit) {
      const a = byTool.get(e.toolName) ?? emptyAgg()
      a.calls++
      if (e.approved) a.approved++
      else a.rejected++
      if (e.error) a.errors++
      byTool.set(e.toolName, a)
    }
    out.push(`## ${tMain('main.governance.byToolTitle')}`, '')
    out.push(tMain('main.governance.byToolCols'), '| --- | --- | --: | --: | --: | --: |')
    for (const [name, a] of [...byTool.entries()].sort((x, y) => y[1].calls - x[1].calls)) {
      out.push(`| ${cell(name)} | ${cell(serverOf(name))} | ${a.calls} | ${a.approved} | ${a.rejected} | ${a.errors} |`)
    }
    out.push('')

    // 各 MCP server（治理支柱）
    const byServer = new Map<string, ToolAgg>()
    for (const e of audit) {
      const s = serverOf(e.toolName)
      const a = byServer.get(s) ?? emptyAgg()
      a.calls++
      if (e.approved) a.approved++
      else a.rejected++
      if (e.error) a.errors++
      byServer.set(s, a)
    }
    out.push(`## ${tMain('main.governance.byServerTitle')}`, '')
    out.push(tMain('main.governance.byServerCols'), '| --- | --: | --: |')
    for (const [s, a] of [...byServer.entries()].sort((x, y) => y[1].calls - x[1].calls)) {
      const r = a.calls ? Math.round((a.approved / a.calls) * 100) : 0
      out.push(`| ${cell(s)} | ${a.calls} | ${r}% |`)
    }
    out.push('')

    // 各 session
    const bySession = new Map<string, ToolAgg & { min: number; max: number }>()
    for (const e of audit) {
      const a = bySession.get(e.sessionId) ?? { ...emptyAgg(), min: e.ts, max: e.ts }
      a.calls++
      if (e.approved) a.approved++
      else a.rejected++
      a.min = Math.min(a.min, e.ts)
      a.max = Math.max(a.max, e.ts)
      bySession.set(e.sessionId, a)
    }
    out.push(`## ${tMain('main.governance.bySessionTitle')}`, '')
    out.push(tMain('main.governance.bySessionCols'), '| --- | --: | --: | --: | --- |')
    for (const [sid, a] of [...bySession.entries()].sort((x, y) => y[1].max - x[1].max)) {
      out.push(`| ${cell(sid.slice(0, 8))} | ${a.calls} | ${a.approved} | ${a.rejected} | ${stamp(a.min)} – ${stamp(a.max)} |`)
    }
    out.push('')

    // 完整稽核軌跡（時間序）
    out.push(`## ${tMain('main.governance.trailTitle')}`, '')
    out.push(tMain('main.governance.trailCols'), '| --- | --- | --- | --- | --- |')
    for (const e of audit) {
      const decision = e.approved
        ? tMain('main.governance.approved')
        : tMain('main.governance.rejected')
      const summary = cell(truncate(e.error ? e.error : e.resultSummary ?? '', 120))
      out.push(`| ${stamp(e.ts)} | ${cell(e.toolName)} | ${cell(serverOf(e.toolName))} | ${decision} | ${summary} |`)
    }
    out.push('')
  }

  out.push('---', '', `_${tMain('main.governance.footer')}_`, '')
  return out.join('\n')
}

/**
 * 匯出治理稽核報表：彙整整份稽核日誌，跳出「另存新檔」，可選 HTML（預設）或 Markdown。
 * 沿用 lastExportDir 與測試路徑（NS_EXPORT_TEST_DIR；NS_EXPORT_FORMAT=html 指定格式）。
 */
export async function exportGovernanceReport(win: BrowserWindow | null): Promise<ExportResult> {
  try {
    const md = governanceReportToMarkdown(listAudit(), getTools())
    const title = tMain('main.governance.title')
    const d = new Date()
    const base = `notesentry-governance-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`

    const testDir = process.env.NS_EXPORT_TEST_DIR
    if (testDir) {
      const html = process.env.NS_EXPORT_FORMAT === 'html'
      const p = join(testDir, `${base}.${html ? 'html' : 'md'}`)
      writeFileSync(p, html ? caseReportToHtml(md, title) : md, 'utf-8')
      return { saved: true, path: p }
    }

    const cfg = loadConfig()
    const remembered = cfg.lastExportDir && existsSync(cfg.lastExportDir) ? cfg.lastExportDir : null
    const startDir = remembered ?? app.getPath('documents')
    const opts = {
      defaultPath: join(startDir, `${base}.html`),
      filters: [
        { name: 'HTML', extensions: ['html'] },
        { name: 'Markdown', extensions: ['md'] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation'] as Array<
        'createDirectory' | 'showOverwriteConfirmation'
      >
    }
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (res.canceled || !res.filePath) return { saved: false, canceled: true }
    const isMd = /\.md$/i.test(res.filePath)
    writeFileSync(res.filePath, isMd ? md : caseReportToHtml(md, title), 'utf-8')
    saveConfig({ ...loadConfig(), lastExportDir: dirname(res.filePath) })
    return { saved: true, path: res.filePath }
  } catch (err) {
    return { saved: false, error: err instanceof Error ? err.message : String(err) }
  }
}
