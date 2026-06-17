import type { Message as OllamaMessage } from 'ollama'
import {
  ChatMessage,
  ChatSendPayload,
  ChatTokenEvent,
  ChatMessageEvent,
  ChatDoneEvent,
  ChatErrorEvent,
  HitlRequestEvent,
  AuditEntry,
  ToolCall,
  ToolInfo
} from '@shared/types'
import { streamChat } from '../ollama/ollamaClient'
import { getTools, callTool } from '../mcp/mcpClient'
import { toOllamaTools } from '../mcp/toolMapping'
import { nextApprovalId, waitForApproval } from '../hitl/approvalBroker'
import { recordAudit } from '../audit/auditLog'
import { loadConfig } from '../config/configStore'
import { tMain } from '../i18n'

// 安全上限預設值：避免模型無限呼叫工具導致迴圈打不停（可於設定頁「AI 行為」調整，夾 1–20）。
const DEFAULT_MAX_TURNS = 12
const RESULT_SUMMARY_MAX = 4000

/** 把目前實際可用的工具清單接進 system prompt（語言依設定），避免模型臆造不存在的工具/資料表。 */
function buildSystemPrompt(tools: ToolInfo[]): string {
  const base = tMain('prompt.system')
  if (tools.length === 0) {
    return `${base}\n\n${tMain('prompt.noTools')}`
  }
  const list = tools
    .map((t) => `- ${t.name}（${t.serverName}）：${t.description || ''}`)
    .join('\n')
  return `${base}\n\n${tMain('prompt.toolsHeader')}\n${list}`
}

/** 回傳目前實際會送出的系統提示（含目前連上的工具清單、語言依設定），供設定頁透明化預覽。 */
export function getSystemPromptPreview(): string {
  return buildSystemPrompt(getTools())
}

let idSeq = 0
function newId(prefix: string): string {
  idSeq += 1
  return `${prefix}_${Date.now()}_${idSeq}`
}

/** 主行程把這組回呼接到 webContents.send / approvalBroker。 */
export interface AgentEmitter {
  token: (e: ChatTokenEvent) => void
  message: (e: ChatMessageEvent) => void
  done: (e: ChatDoneEvent) => void
  error: (e: ChatErrorEvent) => void
  hitlRequest: (e: HitlRequestEvent) => void
  audit: (e: AuditEntry) => void
}

/** 把渲染端的對話歷史轉成 Ollama 訊息格式（system prompt 內含可用工具清單）。 */
function toOllamaMessages(history: ChatMessage[], tools: ToolInfo[]): OllamaMessage[] {
  const out: OllamaMessage[] = [{ role: 'system', content: buildSystemPrompt(tools) }]
  for (const m of history) {
    if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: m.content,
        tool_calls: m.toolCalls?.map((tc) => ({
          function: { name: tc.name, arguments: tc.args }
        }))
      })
    } else if (m.role === 'tool') {
      out.push({ role: 'tool', content: m.content })
    } else if (m.role === 'user') {
      out.push({ role: 'user', content: m.content })
    }
  }
  return out
}

/**
 * 執行一次完整的 agent 迴圈：串流回答 → 若有 tool_calls 則逐一經 HITL 核可 →
 * 核可後呼叫 MCP 工具並回填 → 直到模型給出不含工具呼叫的最終回答。
 */
export async function runAgentLoop(
  payload: ChatSendPayload,
  emit: AgentEmitter,
  abortSignal: AbortSignal
): Promise<void> {
  const { sessionId } = payload
  const tools = getTools()
  const ollamaTools = toOllamaTools(tools)

  const messages = toOllamaMessages(payload.history, tools)
  messages.push({ role: 'user', content: payload.text })

  const maxTurns = Math.round(Math.min(20, Math.max(1, loadConfig().maxTurns ?? DEFAULT_MAX_TURNS)))

  try {
    for (let turn = 0; turn < maxTurns; turn++) {
      if (abortSignal.aborted) {
        emit.done({ sessionId })
        return
      }

      const messageId = newId('asst')
      const { content, toolCalls } = await streamChat(
        messages,
        ollamaTools,
        (delta) => emit.token({ sessionId, messageId, delta }),
        abortSignal
      )

      const assistantToolCalls: ToolCall[] = toolCalls.map((tc) => ({
        id: newId('call'),
        name: tc.name,
        args: tc.args
      }))

      const assistantMsg: ChatMessage = {
        id: messageId,
        role: 'assistant',
        content,
        toolCalls: assistantToolCalls.length > 0 ? assistantToolCalls : undefined,
        createdAt: Date.now()
      }
      emit.message({ sessionId, message: assistantMsg })
      messages.push({
        role: 'assistant',
        content,
        tool_calls: assistantToolCalls.map((tc) => ({
          function: { name: tc.name, arguments: tc.args }
        }))
      })

      // 沒有工具呼叫 → 這就是最終回答。
      if (assistantToolCalls.length === 0) {
        emit.done({ sessionId })
        return
      }

      // 逐一處理工具呼叫，每個都要先經過人類覆核。
      for (const call of assistantToolCalls) {
        const approvalId = nextApprovalId()
        const matched = tools.find((t) => t.name === call.name)
        emit.hitlRequest({
          approvalId,
          sessionId,
          toolName: call.name,
          args: call.args,
          description: matched?.description,
          serverName: matched?.serverName
        })

        const approved = await waitForApproval(approvalId)

        let toolContent: string
        const auditBase: AuditEntry = {
          ts: Date.now(),
          sessionId,
          toolName: call.name,
          args: call.args,
          approved
        }

        if (!approved) {
          toolContent = tMain('prompt.toolRejected', { name: call.name })
          recordAuditAndEmit(emit, auditBase)
        } else {
          try {
            const result = await callTool(call.name, call.args)
            toolContent = result
            recordAuditAndEmit(emit, {
              ...auditBase,
              resultSummary: result.slice(0, RESULT_SUMMARY_MAX)
            })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            toolContent = tMain('prompt.toolFailed', { name: call.name, error: msg })
            recordAuditAndEmit(emit, { ...auditBase, error: msg })
          }
        }

        const toolMsg: ChatMessage = {
          id: newId('tool'),
          role: 'tool',
          content: toolContent,
          toolCallId: call.id,
          createdAt: Date.now()
        }
        emit.message({ sessionId, message: toolMsg })
        messages.push({ role: 'tool', content: toolContent })
      }
      // 回到迴圈頂端，讓模型根據工具結果續寫。
    }

    // 達到回合上限：仍視為結束，避免卡死。
    emit.done({ sessionId })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    emit.error({ sessionId, error: message })
  }
}

function recordAuditAndEmit(emit: AgentEmitter, entry: AuditEntry): void {
  recordAudit(entry)
  emit.audit(entry)
}
