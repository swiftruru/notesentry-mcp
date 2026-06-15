import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync
} from 'node:fs'
import { resolve, join } from 'node:path'
import { Conversation, ConversationMeta } from '@shared/types'
import { getDataRoot } from '../paths'

// 對話紀錄存在「資料根」內（開發＝專案根、打包＝userData）；含臨床文本，皆在本機、符合 DUA。
function convDir(): string {
  return resolve(getDataRoot(), 'conversations')
}
function indexPath(): string {
  return join(convDir(), 'index.json')
}

let index: ConversationMeta[] | null = null

function ensureDir(): void {
  const dir = convDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

/** id 只接受英數、底線、連字號，避免路徑跳脫。 */
function safeId(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`非法的對話 id：${id}`)
  return id
}

function fileFor(id: string): string {
  return join(convDir(), `${safeId(id)}.json`)
}

function metaOf(conv: Conversation): ConversationMeta {
  const firstUser = conv.messages.find((m) => m.role === 'user')
  return {
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    messageCount: conv.messages.length,
    preview: firstUser ? firstUser.content.slice(0, 80) : undefined
  }
}

/** 載入索引；若缺失或損毀，從目錄內的對話檔重建。 */
function loadIndex(): ConversationMeta[] {
  if (index) return index
  ensureDir()
  if (existsSync(indexPath())) {
    try {
      index = JSON.parse(readFileSync(indexPath(), 'utf-8')) as ConversationMeta[]
      return index
    } catch {
      /* 索引壞掉 → 改用重建 */
    }
  }
  index = rebuildIndex()
  writeIndex()
  return index
}

function rebuildIndex(): ConversationMeta[] {
  ensureDir()
  const metas: ConversationMeta[] = []
  for (const f of readdirSync(convDir())) {
    if (!f.endsWith('.json') || f === 'index.json') continue
    try {
      const conv = JSON.parse(readFileSync(join(convDir(), f), 'utf-8')) as Conversation
      metas.push(metaOf(conv))
    } catch {
      /* 跳過壞檔 */
    }
  }
  return metas.sort((a, b) => b.updatedAt - a.updatedAt)
}

function writeIndex(): void {
  if (!index) return
  try {
    ensureDir()
    writeFileSync(indexPath(), JSON.stringify(index, null, 2), 'utf-8')
  } catch (err) {
    console.error('[conv] 寫入 index.json 失敗：', err)
  }
}

export function listConversations(): ConversationMeta[] {
  // 自我修復：剔除索引中「檔案已不存在」的孤兒項（避免點了載入失敗的幽靈對話）。
  const idx = loadIndex()
  const alive = idx.filter((m) => {
    try {
      return existsSync(fileFor(m.id))
    } catch {
      return false
    }
  })
  if (alive.length !== idx.length) {
    index = alive
    writeIndex()
  }
  return [...alive].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function loadConversation(id: string): Conversation | null {
  try {
    const p = fileFor(id)
    if (!existsSync(p)) return null
    return JSON.parse(readFileSync(p, 'utf-8')) as Conversation
  } catch (err) {
    console.error('[conv] 讀取對話失敗：', err)
    return null
  }
}

/** 新增或覆寫一段對話，並同步更新索引。回傳該對話的中繼資料。 */
export function saveConversation(conv: Conversation): ConversationMeta {
  ensureDir()
  safeId(conv.id)
  writeFileSync(fileFor(conv.id), JSON.stringify(conv, null, 2), 'utf-8')
  const meta = metaOf(conv)
  const idx = loadIndex()
  const at = idx.findIndex((m) => m.id === conv.id)
  if (at >= 0) idx[at] = meta
  else idx.push(meta)
  writeIndex()
  return meta
}

export function renameConversation(id: string, title: string): void {
  const conv = loadConversation(id)
  if (!conv) return
  conv.title = title
  conv.updatedAt = Date.now()
  saveConversation(conv)
}

export function deleteConversation(id: string): void {
  try {
    const p = fileFor(id)
    if (existsSync(p)) rmSync(p)
  } catch (err) {
    console.error('[conv] 刪除對話失敗：', err)
  }
  const idx = loadIndex()
  index = idx.filter((m) => m.id !== id)
  writeIndex()
}

/**
 * 搜尋:先比對索引的標題/摘要(快),再掃對話檔內文補齊命中。回傳中繼資料清單。
 */
export function searchConversations(query: string): ConversationMeta[] {
  const q = query.trim().toLowerCase()
  if (!q) return listConversations()
  const idx = loadIndex()
  const hits = new Map<string, ConversationMeta>()
  for (const m of idx) {
    if (
      m.title.toLowerCase().includes(q) ||
      (m.preview ?? '').toLowerCase().includes(q)
    ) {
      hits.set(m.id, m)
    }
  }
  // 內文掃描（補齊標題/摘要未命中者）
  for (const m of idx) {
    if (hits.has(m.id)) continue
    const conv = loadConversation(m.id)
    if (conv && conv.messages.some((msg) => msg.content.toLowerCase().includes(q))) {
      hits.set(m.id, m)
    }
  }
  return [...hits.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}
