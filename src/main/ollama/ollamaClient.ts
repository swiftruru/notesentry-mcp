import { Ollama } from 'ollama'
import type { Message as OllamaMessage, Tool as OllamaTool } from 'ollama'
import { loadConfig, isLocalOllama } from '../config/configStore'
import { ChatMessage } from '@shared/types'
import { tMain } from '../i18n'

/** 把 isLocalOllama 的守門結果轉成（翻譯後的）錯誤訊息。 */
function localGuardError(guard: {
  ok: boolean
  reasonKey?: string
  vars?: Record<string, string>
}): string {
  return guard.reasonKey ? tMain(guard.reasonKey, guard.vars) : tMain('main.error.ollamaBlocked')
}

// 本機 Ollama 推論封裝。每次呼叫都重新讀設定，以套用設定頁的最新 host/model。
export interface StreamResult {
  /** 累積的文字內容 */
  content: string
  /** 模型要求的工具呼叫（若有） */
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>
}

/** 列出本機 Ollama 已安裝的模型名稱（含 tag，例如 gpt-oss:20b、qwen2.5:latest）。 */
export async function listModels(): Promise<string[]> {
  const cfg = loadConfig()
  const guard = isLocalOllama(cfg.ollamaUrl)
  if (!guard.ok) throw new Error(localGuardError(guard))
  const client = new Ollama({ host: cfg.ollamaUrl })
  const res = await client.list()
  const names = (res.models ?? [])
    .map((m) => (m as { name?: string; model?: string }).name ?? (m as { model?: string }).model)
    .filter((n): n is string => !!n)
  return Array.from(new Set(names)).sort()
}

function makeClient(): { client: Ollama; model: string } {
  const cfg = loadConfig()
  const guard = isLocalOllama(cfg.ollamaUrl)
  // 硬性限制：非本機位址直接拒絕，資料不可送往第三方。
  if (!guard.ok) throw new Error(localGuardError(guard))
  return { client: new Ollama({ host: cfg.ollamaUrl }), model: cfg.model }
}

/**
 * 串流式對話。每收到一段文字就呼叫 onToken；結束後回傳完整內容與工具呼叫。
 * abortSignal 可中止本次串流。
 */
export async function streamChat(
  messages: OllamaMessage[],
  tools: OllamaTool[],
  onToken: (delta: string) => void,
  abortSignal?: AbortSignal
): Promise<StreamResult> {
  const { client, model } = makeClient()

  if (abortSignal) {
    abortSignal.addEventListener('abort', () => client.abort(), { once: true })
  }

  const response = await client.chat({
    model,
    messages,
    tools: tools.length > 0 ? tools : undefined,
    stream: true,
    // 低溫：臨床資料助理需要更確定性的行為——提升工具呼叫格式遵循度、降低臆造。
    options: { temperature: 0.3 }
  })

  let content = ''
  const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = []

  for await (const part of response) {
    const msg = part.message
    if (msg?.content) {
      content += msg.content
      onToken(msg.content)
    }
    if (msg?.tool_calls) {
      for (const tc of msg.tool_calls) {
        const args = tc.function.arguments
        toolCalls.push({
          name: tc.function.name,
          args: (typeof args === 'string'
            ? safeParse(args)
            : (args as Record<string, unknown>)) ?? {}
        })
      }
    }
  }

  return { content, toolCalls }
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

/**
 * 依首輪問答產生簡短對話標題（非串流、不帶工具）。沿用本機守門。
 * 失敗時回傳由使用者輸入截斷的後備標題，不致中斷流程。
 */
export async function generateTitle(
  userText: string,
  assistantText: string
): Promise<string> {
  const fallback = userText.trim().slice(0, 20) || tMain('prompt.title.fallback')
  try {
    const { client, model } = makeClient()
    // 以串流取得（headers 立即回，避免大模型非串流時的 undici headers timeout）。
    const response = await client.chat({
      model,
      stream: true,
      messages: [
        { role: 'system', content: tMain('prompt.title.system') },
        {
          role: 'user',
          content: `${tMain('prompt.role.user')}：${userText}\n\n${tMain('prompt.role.assistant')}：${assistantText}`.slice(
            0,
            2000
          )
        }
      ]
    })
    let raw = ''
    for await (const part of response) raw += part.message?.content ?? ''
    // 去掉可能的 <think> 推理區塊與包裹引號，取最後一行。
    let title = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    title = title.replace(/^["'「『]|["'」』]$/g, '').trim()
    title = title.split('\n').filter(Boolean).pop()?.trim() || title
    return title ? title.slice(0, 24) : fallback
  } catch (err) {
    console.error('[ollama] 產生標題失敗：', err)
    return fallback
  }
}

/**
 * 用本機 LLM 產生一個「合成範例病例」填入應用表單（檢傷／SOAP）。
 * 要求模型只輸出 JSON；以串流取得避免 headers timeout。失敗回 null（呼叫端退回內建範例）。
 */
export async function generateSample(
  kind: 'triage' | 'soap'
): Promise<Record<string, unknown> | null> {
  try {
    const { client, model } = makeClient()
    const sys = tMain(kind === 'triage' ? 'prompt.sample.triageSystem' : 'prompt.sample.soapSystem')
    const response = await client.chat({
      model,
      stream: true,
      // 高溫以增加病例多樣性（這是合成資料，不涉及臨床推論）。
      options: { temperature: 0.9 },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: tMain('prompt.sample.user') }
      ]
    })
    let raw = ''
    for await (const part of response) raw += part.message?.content ?? ''
    raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '')
    const m = raw.match(/\{[\s\S]*\}/) // 取第一個 JSON 物件區塊
    if (!m) return null
    const obj = JSON.parse(m[0])
    return obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : null
  } catch (err) {
    console.error('[ollama] 產生範例病例失敗：', err)
    return null
  }
}

function roleLabel(role: string): string {
  if (role === 'user' || role === 'assistant' || role === 'tool') {
    return tMain(`prompt.role.${role}`)
  }
  return role
}

/**
 * 依對話內容產生 3 個「可能會接著問」的後續建議問句（語言依設定、可點擊）。
 * 串流取得以避免 headers timeout；失敗回空陣列（UI 就不顯示建議）。
 */
export async function suggestFollowups(history: ChatMessage[]): Promise<string[]> {
  try {
    const { client, model } = makeClient()
    const ctx = history
      .filter((m) => m.role !== 'system' && m.content.trim())
      .slice(-6)
      .map((m) => `${roleLabel(m.role)}：${m.content.slice(0, 600)}`)
      .join('\n')
    if (!ctx) return []

    const response = await client.chat({
      model,
      stream: true,
      options: { temperature: 0.6 },
      messages: [
        { role: 'system', content: tMain('prompt.followup.system') },
        { role: 'user', content: ctx }
      ]
    })
    let raw = ''
    for await (const part of response) raw += part.message?.content ?? ''
    raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '')
    const lines = raw
      .split('\n')
      .map((s) => s.replace(/^[\s\-*•]+/, '').replace(/^\d+[.)、]\s*/, '').trim())
      .map((s) => s.replace(/^["'「『]|["'」』]$/g, '').trim())
      .filter((s) => s.length > 0 && s.length <= 40)
    return Array.from(new Set(lines)).slice(0, 3)
  } catch (err) {
    console.error('[ollama] 產生後續建議失敗：', err)
    return []
  }
}
