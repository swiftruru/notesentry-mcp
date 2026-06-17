import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import {
  IPC,
  NoteSentryApi,
  ChatSendPayload,
  HitlRespondPayload,
  AppConfig,
  Conversation
} from '@shared/types'

// 把一個 main->renderer 事件包成「訂閱即回傳取消函式」的形狀。
function subscribe<T>(
  channel: string,
  cb: (payload: T) => void
): () => void {
  const listener = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: NoteSentryApi = {
  chatSend: (payload: ChatSendPayload) => ipcRenderer.invoke(IPC.CHAT_SEND, payload),
  chatAbort: (sessionId: string) => ipcRenderer.invoke(IPC.CHAT_ABORT, sessionId),
  hitlRespond: (payload: HitlRespondPayload) =>
    ipcRenderer.invoke(IPC.HITL_RESPOND, payload),
  listTools: () => ipcRenderer.invoke(IPC.TOOLS_LIST),
  getMcpStatus: () => ipcRenderer.invoke(IPC.MCP_STATUS),
  reconnectMcp: () => ipcRenderer.invoke(IPC.MCP_RECONNECT),
  getConfig: () => ipcRenderer.invoke(IPC.CONFIG_GET),
  setConfig: (config: AppConfig) => ipcRenderer.invoke(IPC.CONFIG_SET, config),
  setLanguage: (language: string) => ipcRenderer.invoke(IPC.LANG_SET, language),
  setTheme: (theme) => ipcRenderer.invoke(IPC.THEME_SET, theme),
  setAppearance: (a) => ipcRenderer.invoke(IPC.APPEARANCE_SET, a),
  listModels: () => ipcRenderer.invoke(IPC.OLLAMA_MODELS),
  checkEnvironment: () => ipcRenderer.invoke(IPC.ENV_CHECK),
  listAudit: () => ipcRenderer.invoke(IPC.AUDIT_LIST),
  exportAudit: (entries) => ipcRenderer.invoke(IPC.AUDIT_EXPORT, entries),
  exportGovernanceReport: () => ipcRenderer.invoke(IPC.AUDIT_REPORT),

  listConversations: () => ipcRenderer.invoke(IPC.CONV_LIST),
  loadConversation: (id: string) => ipcRenderer.invoke(IPC.CONV_LOAD, id),
  saveConversation: (conv: Conversation) => ipcRenderer.invoke(IPC.CONV_SAVE, conv),
  renameConversation: (id: string, title: string) =>
    ipcRenderer.invoke(IPC.CONV_RENAME, id, title),
  deleteConversation: (id: string) => ipcRenderer.invoke(IPC.CONV_DELETE, id),
  searchConversations: (query: string) => ipcRenderer.invoke(IPC.CONV_SEARCH, query),
  generateTitle: (userText: string, assistantText: string) =>
    ipcRenderer.invoke(IPC.CONV_GEN_TITLE, userText, assistantText),
  suggestFollowups: (history) => ipcRenderer.invoke(IPC.CHAT_SUGGEST, history),
  generateSample: (kind) => ipcRenderer.invoke(IPC.SAMPLE_GENERATE, kind),
  exportMarkdown: (conv) => ipcRenderer.invoke(IPC.CONV_EXPORT_MD, conv),
  exportCaseReport: (conv) => ipcRenderer.invoke(IPC.CONV_EXPORT_REPORT, conv),
  getSystemPrompt: () => ipcRenderer.invoke(IPC.AGENT_SYSTEM_PROMPT),
  saveTextFile: (defaultName, content) =>
    ipcRenderer.invoke(IPC.FILE_SAVE_TEXT, defaultName, content),

  onChatToken: (cb) => subscribe(IPC.EVT_CHAT_TOKEN, cb),
  onChatMessage: (cb) => subscribe(IPC.EVT_CHAT_MESSAGE, cb),
  onChatDone: (cb) => subscribe(IPC.EVT_CHAT_DONE, cb),
  onChatError: (cb) => subscribe(IPC.EVT_CHAT_ERROR, cb),
  onHitlRequest: (cb) => subscribe(IPC.EVT_HITL_REQUEST, cb),
  onAuditNew: (cb) => subscribe(IPC.EVT_AUDIT_NEW, cb),
  onMcpStatus: (cb) => subscribe(IPC.EVT_MCP_STATUS, cb),
  onToolsUpdated: (cb) => subscribe(IPC.EVT_TOOLS_UPDATED, cb)
}

contextBridge.exposeInMainWorld('api', api)

// 測試專用：主程式以 additionalArguments 傳入 --ns-test（只在自動化測試出現）。
// 暴露布林旗標供渲染端掛上測試輔助函式（見 App.tsx）；正式執行下不存在。
if (process.argv.includes('--ns-test')) {
  contextBridge.exposeInMainWorld('__nsTest', true)
}
