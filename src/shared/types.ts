// 主行程與渲染行程共用的型別與 IPC 通道常數。
// 這個檔案不可 import 任何 Node 或 Electron 專屬模組，渲染端也會用到它。

/** IPC 通道名稱（單一事實來源，避免字串散落各處打錯字） */
export const IPC = {
  // renderer -> main（invoke / handle）
  CHAT_SEND: 'chat:send',
  CHAT_ABORT: 'chat:abort',
  HITL_RESPOND: 'hitl:respond',
  TOOLS_LIST: 'tools:list',
  MCP_STATUS: 'mcp:status',
  MCP_RECONNECT: 'mcp:reconnect',
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  OLLAMA_MODELS: 'ollama:models',
  ENV_CHECK: 'env:check',
  AUDIT_LIST: 'audit:list',
  AUDIT_EXPORT: 'audit:export',
  AUDIT_REPORT: 'audit:report',
  CONV_LIST: 'conv:list',
  CONV_LOAD: 'conv:load',
  CONV_SAVE: 'conv:save',
  CONV_RENAME: 'conv:rename',
  CONV_DELETE: 'conv:delete',
  CONV_SEARCH: 'conv:search',
  CONV_GEN_TITLE: 'conv:genTitle',
  CONV_EXPORT_MD: 'conv:exportMd',
  CONV_EXPORT_REPORT: 'conv:exportReport',
  AGENT_SYSTEM_PROMPT: 'agent:systemPrompt',
  FILE_SAVE_TEXT: 'file:saveText',
  CHAT_SUGGEST: 'chat:suggest',
  SAMPLE_GENERATE: 'sample:generate',
  LANG_SET: 'lang:set',
  THEME_SET: 'theme:set',
  APPEARANCE_SET: 'appearance:set',

  // main -> renderer（send / on）
  EVT_CHAT_TOKEN: 'evt:chat:token',
  EVT_CHAT_MESSAGE: 'evt:chat:message',
  EVT_CHAT_DONE: 'evt:chat:done',
  EVT_CHAT_ERROR: 'evt:chat:error',
  EVT_HITL_REQUEST: 'evt:hitl:request',
  EVT_AUDIT_NEW: 'evt:audit:new',
  EVT_MCP_STATUS: 'evt:mcp:status',
  EVT_TOOLS_UPDATED: 'evt:tools:updated'
} as const

/** 單一 MCP server 設定（每支對應一個 Python stdio 子行程） */
export interface McpServerConfig {
  /** 穩定識別碼，用於路由與 UI 分組 */
  id: string
  /** 顯示名稱 */
  name: string
  /** server 腳本路徑（相對路徑以專案根為基準）。未填 command 時走「python <scriptPath>」啟動。 */
  scriptPath: string
  /** 是否啟用（停用則不連線） */
  enabled: boolean
  /**
   * 標準 MCP 啟動指令（如 npx / node / python3 / uvx）。填了就走標準模式，
   * 與 Claude Desktop / mcp.json 的 command 同義；未填則回退為 python <scriptPath>。
   */
  command?: string
  /** 標準 MCP 啟動參數（command 模式用） */
  args?: string[]
  /** 額外環境變數（command 模式用；會與系統環境合併，使用者值優先） */
  env?: Record<string, string>
}

/** 應用程式設定（持久化於專案資料夾的 config.json） */
export interface AppConfig {
  ollamaUrl: string
  model: string
  pythonPath: string
  /** 傳給所有 MCP server 的 SQLite 路徑（經 env MIMIC_DB_PATH；不需資料庫的 server 會忽略） */
  dbPath: string
  /** 多個 MCP server（對應簡報的 HIS/NIS/LIS… 多 MCP 架構） */
  mcpServers: McpServerConfig[]
  /** agent 取樣溫度（0–1；越低越確定、越遵循工具格式）。預設 0.3。 */
  temperature?: number
  /** 單次回答最多連續呼叫工具的回合上限（1–20），避免無限迴圈。預設 12。 */
  maxTurns?: number
  /** 介面與模型回答的語言（locale 代碼，如 zh-TW / en）；用 string 以利擴充第三語言 */
  language?: string
  /** 介面主題：light / dark / system（跟隨作業系統） */
  theme?: ThemeMode
  /** 字級縮放（無障礙）：sm/md/lg/xl，預設 md */
  fontScale?: FontScale
  /** 高對比模式（無障礙），預設 false */
  highContrast?: boolean
  /** 上次匯出 Markdown 所選的資料夾（記住偏好，非設定頁欄位） */
  lastExportDir?: string
  /** 上次的視窗大小／位置（下次開啟還原；非設定頁欄位） */
  windowBounds?: WindowBounds
}

export type ThemeMode = 'light' | 'dark' | 'system'

/** 字級縮放級別（無障礙）。 */
export type FontScale = 'sm' | 'md' | 'lg' | 'xl'

/** 視窗幾何（記住大小/位置/最大化狀態） */
export interface WindowBounds {
  width: number
  height: number
  x?: number
  y?: number
  maximized?: boolean
}

export const DEFAULT_CONFIG: AppConfig = {
  ollamaUrl: 'http://localhost:11434',
  // 預設用工具呼叫最穩定的模型（與 README/安裝指引一致）；較低階機器可在設定改 qwen2.5。
  model: 'gpt-oss:20b',
  pythonPath: 'python3',
  dbPath: './mimic_notes.db',
  temperature: 0.3,
  maxTurns: 12,
  language: 'zh-TW',
  theme: 'system',
  fontScale: 'md',
  highContrast: false,
  mcpServers: [
    {
      id: 'mimic',
      name: 'MIMIC 病歷查詢（HIS）',
      scriptPath: './mcp/servers/mimic_mcp_server.py',
      enabled: true
    },
    {
      id: 'clinical',
      name: '臨床輔助（檢傷／SOAP）',
      scriptPath: './mcp/servers/clinical_support_mcp_server.py',
      enabled: true
    },
    {
      id: 'nis',
      name: 'NIS 護理／生命徵象（FHIR）',
      scriptPath: './mcp/servers/nis_fhir_mcp_server.py',
      enabled: true
    },
    {
      id: 'pharmacy',
      name: '藥事輔助（用藥／過敏／交互作用）',
      scriptPath: './mcp/servers/pharmacy_support_mcp_server.py',
      enabled: true
    }
  ]
}

/** MCP 工具（轉成渲染端與 Ollama 都好用的形狀） */
export interface ToolInfo {
  name: string
  description: string
  /** JSON Schema（取自 MCP inputSchema），用於顯示與 Ollama tool 定義 */
  inputSchema: Record<string, unknown>
  /** 此工具所屬的 MCP server id 與名稱（用於路由與 UI 分組） */
  serverId: string
  serverName: string
}

/** MCP 子行程連線狀態 */
export type McpConnState = 'disconnected' | 'connecting' | 'connected' | 'error'

/** 單一 MCP server 的連線狀態 */
export interface McpServerStatus {
  id: string
  name: string
  state: McpConnState
  toolCount: number
  message?: string
  /** MCP 一致性檢查（connected 時填）：server 於 initialize 握手回報的實作名稱／版本 */
  serverInfo?: { name: string; version: string }
  /** server 宣告的能力鍵（如 tools / resources / prompts） */
  capabilities?: string[]
  /** 所有工具的 inputSchema 是否皆為有效的物件式 JSON Schema */
  schemaValid?: boolean
}

/** 對話訊息角色 */
export type ChatRole = 'user' | 'assistant' | 'tool' | 'system'

export interface ToolCall {
  /** 此次呼叫的唯一 id（也用於 HITL 核可關聯） */
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  /** assistant 訊息可能附帶的工具呼叫 */
  toolCalls?: ToolCall[]
  /** tool 訊息對應的 toolCall id */
  toolCallId?: string
  createdAt: number
}

/** 一段完整對話（持久化於 conversations/<id>.json） */
export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  /** 此對話使用的模型（記錄用） */
  model?: string
  messages: ChatMessage[]
}

/** 對話清單用的輕量中繼資料（存於 conversations/index.json） */
export interface ConversationMeta {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  /** 第一則使用者訊息的摘要片段 */
  preview?: string
}

/** 預設標題（未命名前）；用於判斷是否需要自動生成標題 */
export const DEFAULT_CONVERSATION_TITLE = '新對話'

/** 匯出 Markdown 的結果 */
export interface ExportResult {
  saved: boolean
  path?: string
  canceled?: boolean
  error?: string
}

/** 環境診斷結果（連線測試用） */
export interface EnvCheck {
  /** 設定中的 SQLite 路徑（相對） */
  dbPath: string
  /** 解析後的絕對路徑 */
  dbAbsPath: string
  dbExists: boolean
  /** Python 是否可執行 */
  pythonOk: boolean
  /** Python 版本字串或錯誤訊息 */
  pythonInfo: string
}

/** renderer -> main：送出一則使用者提問 */
export interface ChatSendPayload {
  sessionId: string
  text: string
  /** 完整對話歷史（renderer 持有事實，main 無狀態），不含本次 text */
  history: ChatMessage[]
}

/** main -> renderer：串流 token */
export interface ChatTokenEvent {
  sessionId: string
  messageId: string
  delta: string
}

/** main -> renderer：一則完整訊息（assistant 含 toolCalls，或 tool 結果） */
export interface ChatMessageEvent {
  sessionId: string
  message: ChatMessage
}

export interface ChatDoneEvent {
  sessionId: string
}

export interface ChatErrorEvent {
  sessionId: string
  error: string
}

/** main -> renderer：要求人類覆核某個工具呼叫 */
export interface HitlRequestEvent {
  approvalId: string
  sessionId: string
  toolName: string
  args: Record<string, unknown>
  description?: string
  /** 此工具所屬的 MCP server 名稱（給覆核框顯示來源） */
  serverName?: string
}

/** renderer -> main：人類覆核結果 */
export interface HitlRespondPayload {
  approvalId: string
  approved: boolean
}

/** 稽核紀錄一筆（每行一筆 JSONL） */
export interface AuditEntry {
  ts: number
  sessionId: string
  toolName: string
  args: Record<string, unknown>
  approved: boolean
  /** 工具回傳結果摘要（截斷，僅供 UI/稽核參考） */
  resultSummary?: string
  error?: string
}

/** preload 暴露給渲染端的 API 形狀 */
export interface NoteSentryApi {
  chatSend: (payload: ChatSendPayload) => Promise<void>
  chatAbort: (sessionId: string) => Promise<void>
  hitlRespond: (payload: HitlRespondPayload) => Promise<void>
  listTools: () => Promise<ToolInfo[]>
  getMcpStatus: () => Promise<McpServerStatus[]>
  reconnectMcp: () => Promise<McpServerStatus[]>
  getConfig: () => Promise<AppConfig>
  setConfig: (config: AppConfig) => Promise<AppConfig>
  setLanguage: (language: string) => Promise<void>
  setTheme: (theme: ThemeMode) => Promise<void>
  setAppearance: (a: { fontScale?: FontScale; highContrast?: boolean }) => Promise<void>
  listModels: () => Promise<string[]>
  checkEnvironment: () => Promise<EnvCheck>
  listAudit: () => Promise<AuditEntry[]>
  exportAudit: (entries: AuditEntry[]) => Promise<ExportResult>
  exportGovernanceReport: () => Promise<ExportResult>

  listConversations: () => Promise<ConversationMeta[]>
  loadConversation: (id: string) => Promise<Conversation | null>
  saveConversation: (conv: Conversation) => Promise<ConversationMeta>
  renameConversation: (id: string, title: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  searchConversations: (query: string) => Promise<ConversationMeta[]>
  generateTitle: (userText: string, assistantText: string) => Promise<string>
  suggestFollowups: (history: ChatMessage[]) => Promise<string[]>
  generateSample: (
    kind: 'triage' | 'soap' | 'pharmacy' | 'fhir'
  ) => Promise<Record<string, unknown> | null>
  exportMarkdown: (conv: Conversation) => Promise<ExportResult>
  exportCaseReport: (conv: Conversation) => Promise<ExportResult>
  getSystemPrompt: () => Promise<string>
  saveTextFile: (defaultName: string, content: string) => Promise<ExportResult>

  onChatToken: (cb: (e: ChatTokenEvent) => void) => () => void
  onChatMessage: (cb: (e: ChatMessageEvent) => void) => () => void
  onChatDone: (cb: (e: ChatDoneEvent) => void) => () => void
  onChatError: (cb: (e: ChatErrorEvent) => void) => () => void
  onHitlRequest: (cb: (e: HitlRequestEvent) => void) => () => void
  onAuditNew: (cb: (e: AuditEntry) => void) => () => void
  onMcpStatus: (cb: (e: McpServerStatus[]) => void) => () => void
  onToolsUpdated: (cb: (e: ToolInfo[]) => void) => () => void
}
