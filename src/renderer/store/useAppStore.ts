import { create } from 'zustand'
import i18n from '@/i18n'
import {
  AppConfig,
  AuditEntry,
  ChatMessage,
  Conversation,
  ConversationMeta,
  DEFAULT_CONVERSATION_TITLE,
  ExportResult,
  HitlRequestEvent,
  McpServerStatus,
  ToolInfo
} from '@shared/types'

export type ViewKey = 'chat' | 'tools' | 'audit' | 'settings' | 'about'

interface AppState {
  view: ViewKey

  // 進行中的對話
  activeId: string | null
  activeCreatedAt: number
  title: string
  /** 標題是否由系統自動產生（true 時可被首句/LLM 覆寫；手動改名後為 false） */
  titleIsAuto: boolean
  messages: ChatMessage[]
  isStreaming: boolean
  streaming: { id: string; content: string } | null
  pendingHitl: HitlRequestEvent | null
  /** 依對話結果動態產生的後續建議問句（可點擊） */
  suggestions: string[]

  // 對話清單
  conversations: ConversationMeta[]
  searchQuery: string

  // 其他面板
  tools: ToolInfo[]
  mcpServers: McpServerStatus[]
  audit: AuditEntry[]
  config: AppConfig | null

  // actions
  setView: (v: ViewKey) => void
  send: (text: string) => Promise<void>
  abort: () => Promise<void>
  regenerate: () => Promise<void>
  respondHitl: (approved: boolean) => Promise<void>

  newConversation: () => void
  exportMarkdown: () => Promise<ExportResult>
  loadConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  setSearch: (q: string) => Promise<void>
  refreshConversations: () => Promise<void>

  // event handlers（由 App 訂閱呼叫，皆以 sessionId 比對 activeId）
  _onToken: (sessionId: string, id: string, delta: string) => void
  _onMessage: (sessionId: string, m: ChatMessage) => void
  _onDone: (sessionId: string) => void
  _onError: (sessionId: string, err: string) => void
  _onHitl: (e: HitlRequestEvent) => void
  _onAudit: (e: AuditEntry) => void
  _setTools: (t: ToolInfo[]) => void
  _setMcpStatus: (s: McpServerStatus[]) => void

  init: () => Promise<void>
}

let seq = 0
function uiId(prefix: string): string {
  seq += 1
  return `${prefix}_${Date.now()}_${seq}`
}

/** 由首句擷取即時標題（LLM 標題就緒前先頂著，避免清單卡在「新對話」）。 */
function deriveTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length > 20 ? `${t.slice(0, 20)}…` : t || DEFAULT_CONVERSATION_TITLE
}

export const useAppStore = create<AppState>((set, get) => {
  // 防止同一對話同時觸發多個標題生成。
  let titleGenerating = false
  // 建議生成的請求序號（只有最新一次請求的結果會被套用）。
  let suggestSeq = 0
  // 載入舊對話時延遲產生建議的計時器（快速切換會被取消）。
  let loadSuggestTimer: ReturnType<typeof setTimeout> | null = null

  /** 確保有 active 對話 id（首次送訊息時建立）。 */
  const ensureActive = (): string => {
    let id = get().activeId
    if (!id) {
      id = uiId('conv')
      set({
        activeId: id,
        activeCreatedAt: Date.now(),
        title: DEFAULT_CONVERSATION_TITLE,
        titleIsAuto: true,
        messages: []
      })
    }
    return id
  }

  /** 把目前 active 對話寫入磁碟，並把回傳的中繼資料更新到清單頂端。 */
  const persistActive = async (): Promise<void> => {
    const { activeId, title, messages, activeCreatedAt, config } = get()
    if (!activeId || messages.length === 0) return
    const conv: Conversation = {
      id: activeId,
      title,
      createdAt: activeCreatedAt,
      updatedAt: Date.now(),
      model: config?.model,
      messages
    }
    const meta = await window.api.saveConversation(conv)
    set((s) => ({
      conversations: [meta, ...s.conversations.filter((c) => c.id !== meta.id)]
    }))
  }

  /** 首輪問答後用 LLM 升級標題（僅在標題仍為自動、且未在生成中時）。 */
  const maybeGenerateTitle = async (): Promise<void> => {
    const { titleIsAuto, messages, activeId } = get()
    if (!titleIsAuto || titleGenerating) return
    const firstUser = messages.find((m) => m.role === 'user')
    const firstAssistant = messages.find(
      (m) => m.role === 'assistant' && m.content.trim().length > 0
    )
    if (!firstUser || !firstAssistant) return
    titleGenerating = true
    try {
      const generated = await window.api.generateTitle(
        firstUser.content,
        firstAssistant.content
      )
      // 期間使用者可能已切換對話或手動改名，確認仍是同一個且仍為自動標題才套用。
      if (get().activeId !== activeId || !get().titleIsAuto) return
      set({ title: generated })
      await persistActive()
    } finally {
      titleGenerating = false
    }
  }

  /** 依對話內容產生後續建議問句（每輪完成後、或載入舊對話時呼叫）。 */
  const maybeGenerateSuggestions = async (): Promise<void> => {
    const { messages, activeId } = get()
    const hasAssistant = messages.some(
      (m) => m.role === 'assistant' && m.content.trim().length > 0
    )
    if (!hasAssistant) return
    const req = ++suggestSeq
    const tips = await window.api.suggestFollowups(messages)
    // 只有最新一次請求、仍是同一對話、且未在串流，才套用（避免快速切換套到過時建議）。
    if (req !== suggestSeq || get().activeId !== activeId || get().isStreaming) return
    set({ suggestions: tips })
  }

  return {
    view: 'chat',

    activeId: null,
    activeCreatedAt: 0,
    title: DEFAULT_CONVERSATION_TITLE,
    titleIsAuto: false,
    messages: [],
    isStreaming: false,
    streaming: null,
    pendingHitl: null,
    suggestions: [],

    conversations: [],
    searchQuery: '',

    tools: [],
    mcpServers: [],
    audit: [],
    config: null,

    setView: (v) => set({ view: v }),

    send: async (text) => {
      const trimmed = text.trim()
      if (!trimmed || get().isStreaming) return
      if (loadSuggestTimer) clearTimeout(loadSuggestTimer)
      const id = ensureActive()
      const history = get().messages
      const userMsg: ChatMessage = {
        id: uiId('user'),
        role: 'user',
        content: trimmed,
        createdAt: Date.now()
      }
      // 首則訊息：立刻用首句當即時標題（LLM 標題就緒前先頂著）。
      const instantTitle =
        history.length === 0 && get().titleIsAuto ? deriveTitle(trimmed) : get().title
      set({
        messages: [...history, userMsg],
        title: instantTitle,
        isStreaming: true,
        streaming: null,
        suggestions: []
      })
      await persistActive()
      await window.api.chatSend({ sessionId: id, text: trimmed, history })
    },

    abort: async () => {
      const id = get().activeId
      if (id) await window.api.chatAbort(id)
      set({ isStreaming: false, streaming: null, pendingHitl: null, suggestions: [] })
    },

    regenerate: async () => {
      const { isStreaming, messages, activeId } = get()
      if (isStreaming || !activeId) return
      let lastUser = -1
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          lastUser = i
          break
        }
      }
      if (lastUser < 0) return
      const kept = messages.slice(0, lastUser + 1)
      const history = messages.slice(0, lastUser)
      const text = messages[lastUser].content
      set({
        messages: kept,
        isStreaming: true,
        streaming: null,
        pendingHitl: null,
        suggestions: []
      })
      await persistActive()
      await window.api.chatSend({ sessionId: activeId, text, history })
    },

    respondHitl: async (approved) => {
      const p = get().pendingHitl
      if (!p) return
      set({ pendingHitl: null })
      await window.api.hitlRespond({ approvalId: p.approvalId, approved })
    },

    newConversation: () => {
      if (loadSuggestTimer) clearTimeout(loadSuggestTimer)
      if (get().isStreaming && get().activeId) {
        void window.api.chatAbort(get().activeId as string)
      }
      set({
        view: 'chat',
        activeId: null,
        activeCreatedAt: 0,
        title: DEFAULT_CONVERSATION_TITLE,
        titleIsAuto: true,
        messages: [],
        isStreaming: false,
        streaming: null,
        pendingHitl: null,
        suggestions: []
      })
    },

    exportMarkdown: async () => {
      const { activeId, title, messages, activeCreatedAt, config } = get()
      if (!activeId || messages.length === 0) {
        return { saved: false, error: i18n.t('chat:noExport') }
      }
      const conv: Conversation = {
        id: activeId,
        title,
        createdAt: activeCreatedAt,
        updatedAt: Date.now(),
        model: config?.model,
        messages
      }
      return window.api.exportMarkdown(conv)
    },

    loadConversation: async (id) => {
      if (id === get().activeId) {
        set({ view: 'chat' })
        return
      }
      if (get().isStreaming && get().activeId) {
        await window.api.chatAbort(get().activeId as string)
      }
      const conv = await window.api.loadConversation(id)
      if (!conv) {
        // 檔案不存在（例如被外部刪除）→ 重新整理清單，孤兒項會被自動剔除。
        await get().refreshConversations()
        return
      }
      set({
        view: 'chat',
        activeId: conv.id,
        activeCreatedAt: conv.createdAt,
        title: conv.title,
        titleIsAuto: false, // 已存在的對話沿用其標題，不再自動覆寫
        messages: conv.messages,
        isStreaming: false,
        streaming: null,
        pendingHitl: null,
        suggestions: []
      })
      // 載入舊對話時，延遲產生一次建議（快速切換多個對話時會被後續切換取消，避免每個都推論）。
      if (loadSuggestTimer) clearTimeout(loadSuggestTimer)
      if (conv.messages.some((m) => m.role === 'assistant' && m.content.trim())) {
        loadSuggestTimer = setTimeout(() => void maybeGenerateSuggestions(), 600)
      }
    },

    renameConversation: async (id, title) => {
      const t = title.trim()
      if (!t) return
      await window.api.renameConversation(id, t)
      // 手動改名後即固定，不再被自動標題覆寫。
      if (id === get().activeId) set({ title: t, titleIsAuto: false })
      await get().refreshConversations()
    },

    deleteConversation: async (id) => {
      await window.api.deleteConversation(id)
      set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) }))
      if (id === get().activeId) get().newConversation()
    },

    setSearch: async (q) => {
      set({ searchQuery: q })
      const metas = q.trim()
        ? await window.api.searchConversations(q)
        : await window.api.listConversations()
      set({ conversations: metas })
    },

    refreshConversations: async () => {
      const q = get().searchQuery.trim()
      const metas = q
        ? await window.api.searchConversations(q)
        : await window.api.listConversations()
      set({ conversations: metas })
    },

    _onToken: (sessionId, id, delta) => {
      if (sessionId !== get().activeId) return
      const cur = get().streaming
      if (!cur || cur.id !== id) set({ streaming: { id, content: delta } })
      else set({ streaming: { id, content: cur.content + delta } })
    },

    _onMessage: (sessionId, m) => {
      if (sessionId !== get().activeId) return
      const { messages, streaming } = get()
      const nextStreaming = streaming && streaming.id === m.id ? null : streaming
      set({ messages: [...messages, m], streaming: nextStreaming })
      void persistActive()
    },

    _onDone: (sessionId) => {
      if (sessionId !== get().activeId) return
      set({ isStreaming: false, streaming: null })
      void maybeGenerateTitle()
      void maybeGenerateSuggestions()
    },

    _onError: (sessionId, err) => {
      if (sessionId !== get().activeId) return
      const errMsg: ChatMessage = {
        id: uiId('err'),
        role: 'system',
        content: i18n.t('chat:error', { error: err }),
        createdAt: Date.now()
      }
      set((s) => ({
        messages: [...s.messages, errMsg],
        isStreaming: false,
        streaming: null,
        pendingHitl: null
      }))
    },

    _onHitl: (e) => {
      if (e.sessionId !== get().activeId) return
      set({ pendingHitl: e })
    },

    _onAudit: (e) => set((s) => ({ audit: [...s.audit, e] })),

    _setTools: (t) => set({ tools: t }),

    _setMcpStatus: (s) => set({ mcpServers: s }),

    init: async () => {
      const [config, tools, mcpServers, audit, conversations] = await Promise.all([
        window.api.getConfig(),
        window.api.listTools(),
        window.api.getMcpStatus(),
        window.api.listAudit(),
        window.api.listConversations()
      ])
      set({ config, tools, mcpServers, audit, conversations })
    }
  }
})
