import { dialog, BrowserWindow, app } from 'electron'
import { writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { AuditEntry, Conversation, ExportResult } from '@shared/types'
import { loadConfig, saveConfig } from './config/configStore'
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
