import { ipcMain, BrowserWindow } from 'electron'
import {
  IPC,
  ChatSendPayload,
  HitlRespondPayload,
  AppConfig,
  AuditEntry,
  McpServerStatus,
  Conversation,
  ChatMessage
} from '@shared/types'
import { runAgentLoop, AgentEmitter } from './agent/agentLoop'
import { resolveApproval, rejectAllPending } from './hitl/approvalBroker'
import { connectMcp, getMcpStatus, getTools, onMcpStatus } from './mcp/mcpClient'
import { loadConfig, saveConfig } from './config/configStore'
import { listAudit } from './audit/auditLog'
import { generateTitle, listModels, suggestFollowups } from './ollama/ollamaClient'
import { checkEnvironment } from './diagnostics'
import { exportConversationMarkdown } from './export'
import {
  listConversations,
  loadConversation,
  saveConversation,
  renameConversation,
  deleteConversation,
  searchConversations
} from './conversations/conversationStore'

// 進行中的 session 與其 AbortController。
const sessions = new Map<string, AbortController>()

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const send = (channel: string, payload: unknown): void => {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }

  // MCP 狀態變化即時推給渲染端，連同「當下的工具清單」一起推。
  // （啟動時 connectMcp 是非同步完成的；init() 當下工具還沒連好會被快照成空，
  //  之後狀態變「已連線」時必須把工具一併推回，否則工具頁要手動重整才會出現。）
  onMcpStatus((s: McpServerStatus[]) => {
    send(IPC.EVT_MCP_STATUS, s)
    send(IPC.EVT_TOOLS_UPDATED, getTools())
  })

  // --- 對話：跑 agent 迴圈 ---
  ipcMain.handle(IPC.CHAT_SEND, async (_e, payload: ChatSendPayload) => {
    // 同一 session 重送時，先中止舊的。
    sessions.get(payload.sessionId)?.abort()
    const controller = new AbortController()
    sessions.set(payload.sessionId, controller)

    const emit: AgentEmitter = {
      token: (e) => send(IPC.EVT_CHAT_TOKEN, e),
      message: (e) => send(IPC.EVT_CHAT_MESSAGE, e),
      done: (e) => send(IPC.EVT_CHAT_DONE, e),
      error: (e) => send(IPC.EVT_CHAT_ERROR, e),
      hitlRequest: (e) => send(IPC.EVT_HITL_REQUEST, e),
      audit: (e: AuditEntry) => send(IPC.EVT_AUDIT_NEW, e)
    }

    // 不 await：讓 invoke 立即回傳，串流靠事件推送。
    runAgentLoop(payload, emit, controller.signal).finally(() => {
      sessions.delete(payload.sessionId)
    })
  })

  ipcMain.handle(IPC.CHAT_ABORT, async (_e, sessionId: string) => {
    sessions.get(sessionId)?.abort()
    rejectAllPending()
  })

  // --- HITL 核可回覆 ---
  ipcMain.handle(IPC.HITL_RESPOND, async (_e, payload: HitlRespondPayload) => {
    resolveApproval(payload.approvalId, payload.approved)
  })

  // --- 工具與 MCP 狀態 ---
  ipcMain.handle(IPC.TOOLS_LIST, async () => getTools())
  ipcMain.handle(IPC.MCP_STATUS, async () => getMcpStatus())
  ipcMain.handle(IPC.MCP_RECONNECT, async () => {
    const status = await connectMcp()
    send(IPC.EVT_TOOLS_UPDATED, getTools())
    return status
  })

  // --- 設定 ---
  ipcMain.handle(IPC.CONFIG_GET, async () => loadConfig())
  ipcMain.handle(IPC.CONFIG_SET, async (_e, config: AppConfig) => {
    const saved = saveConfig(config)
    // 設定變更（python/script/db/host）後重連 MCP，套用新路徑。
    const status = await connectMcp()
    send(IPC.EVT_MCP_STATUS, status)
    send(IPC.EVT_TOOLS_UPDATED, getTools())
    return saved
  })

  // --- 語言（只存設定，不重連 MCP） ---
  ipcMain.handle(IPC.LANG_SET, async (_e, language: string) => {
    saveConfig({ ...loadConfig(), language })
  })

  // --- 模型偵測 ---
  ipcMain.handle(IPC.OLLAMA_MODELS, async () => listModels())

  // --- 環境診斷 ---
  ipcMain.handle(IPC.ENV_CHECK, async () => checkEnvironment())

  // --- 稽核 ---
  ipcMain.handle(IPC.AUDIT_LIST, async () => listAudit())

  // --- 對話紀錄 ---
  ipcMain.handle(IPC.CONV_LIST, async () => listConversations())
  ipcMain.handle(IPC.CONV_LOAD, async (_e, id: string) => loadConversation(id))
  ipcMain.handle(IPC.CONV_SAVE, async (_e, conv: Conversation) => saveConversation(conv))
  ipcMain.handle(IPC.CONV_RENAME, async (_e, id: string, title: string) =>
    renameConversation(id, title)
  )
  ipcMain.handle(IPC.CONV_DELETE, async (_e, id: string) => deleteConversation(id))
  ipcMain.handle(IPC.CONV_SEARCH, async (_e, query: string) => searchConversations(query))
  ipcMain.handle(IPC.CONV_GEN_TITLE, async (_e, userText: string, assistantText: string) =>
    generateTitle(userText, assistantText)
  )
  ipcMain.handle(IPC.CHAT_SUGGEST, async (_e, history: ChatMessage[]) =>
    suggestFollowups(history)
  )
  ipcMain.handle(IPC.CONV_EXPORT_MD, async (_e, conv: Conversation) =>
    exportConversationMarkdown(conv, getWindow())
  )
}

export function abortAllSessions(): void {
  for (const [, c] of sessions) c.abort()
  sessions.clear()
  rejectAllPending()
}
