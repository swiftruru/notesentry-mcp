import { dialog, BrowserWindow, app } from 'electron'
import { writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { AuditEntry, Conversation, ExportResult } from '@shared/types'
import { loadConfig, saveConfig } from './config/configStore'
import { listAudit } from './audit/auditLog'
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

/** 匯出個案報告為 Markdown：跳出「另存新檔」，沿用 lastExportDir 與測試路徑。 */
export async function exportCaseReport(
  conv: Conversation,
  win: BrowserWindow | null
): Promise<ExportResult> {
  try {
    const md = conversationToCaseReport(conv)
    const d = new Date()
    const fname = `${safeName(conv.title)}-report-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
      d.getDate()
    )}.md`

    const testDir = process.env.NS_EXPORT_TEST_DIR
    if (testDir) {
      const p = join(testDir, fname)
      writeFileSync(p, md, 'utf-8')
      return { saved: true, path: p }
    }

    const cfg = loadConfig()
    const remembered = cfg.lastExportDir && existsSync(cfg.lastExportDir) ? cfg.lastExportDir : null
    const startDir = remembered ?? app.getPath('documents')
    const opts = {
      defaultPath: join(startDir, fname),
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'] as Array<
        'createDirectory' | 'showOverwriteConfirmation'
      >
    }
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (res.canceled || !res.filePath) return { saved: false, canceled: true }
    writeFileSync(res.filePath, md, 'utf-8')
    saveConfig({ ...loadConfig(), lastExportDir: dirname(res.filePath) })
    return { saved: true, path: res.filePath }
  } catch (err) {
    return { saved: false, error: err instanceof Error ? err.message : String(err) }
  }
}
