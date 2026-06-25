import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/primitives'
import { InfoTip } from '@/components/ui/InfoTip'
import { cn } from '@/lib/utils'
import {
  AppConfig,
  McpServerConfig,
  McpServerStatus,
  EnvCheck,
  DEFAULT_CONFIG,
  FontScale
} from '@shared/types'
import {
  Settings as SettingsIcon,
  Save,
  CheckCircle2,
  AlertCircle,
  Server,
  RefreshCw,
  Pencil,
  List,
  Activity,
  Circle,
  Plus,
  Trash2,
  Cpu,
  Database,
  Bot,
  Accessibility
} from 'lucide-react'

type FieldKey = 'ollamaUrl' | 'model' | 'pythonPath' | 'dbPath'

// label/hint 由 i18n 提供；placeholder 為實際值範例，不翻譯。
const FIELDS: { key: FieldKey; placeholder: string }[] = [
  { key: 'ollamaUrl', placeholder: 'http://localhost:11434' },
  { key: 'model', placeholder: 'qwen2.5' },
  { key: 'pythonPath', placeholder: 'python3' },
  { key: 'dbPath', placeholder: './mimic_notes.db' }
]

// 內建 server id 集合：這些可停用但不可刪除（configStore.normalize 會在存檔時自動補回）。
const BUILTIN_IDS = new Set(DEFAULT_CONFIG.mcpServers.map((s) => s.id))

// 設定分頁：依功能橫向切換，避免一頁塞太多。
type SettingsTab = 'inference' | 'runtime' | 'mcp' | 'agent' | 'appearance'
const SETTINGS_TABS: { key: SettingsTab; icon: typeof Cpu }[] = [
  { key: 'inference', icon: Cpu },
  { key: 'runtime', icon: Database },
  { key: 'mcp', icon: Server },
  { key: 'agent', icon: Bot },
  { key: 'appearance', icon: Accessibility }
]

const FONT_SIZES: FontScale[] = ['sm', 'md', 'lg', 'xl']

/** env 物件 ⇄ 文字（每行 KEY=VALUE）的雙向轉換。 */
function serializeEnv(env?: Record<string, string>): string {
  return env
    ? Object.entries(env)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n')
    : ''
}
function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const i = line.indexOf('=')
    if (i <= 0) continue
    const k = line.slice(0, i).trim()
    if (k) out[k] = line.slice(i + 1).trim()
  }
  return out
}

export function SettingsView(): React.JSX.Element {
  const { t, i18n } = useTranslation('settings')
  const config = useAppStore((s) => s.config)
  const setMcpStatus = useAppStore((s) => s._setMcpStatus)
  const setTools = useAppStore((s) => s._setTools)
  const liveStatus = useAppStore((s) => s.mcpServers)
  const setFontScale = useAppStore((s) => s.setFontScale)
  const setHighContrast = useAppStore((s) => s.setHighContrast)
  const [tab, setTab] = useState<SettingsTab>('inference')
  const [draft, setDraft] = useState<AppConfig | null>(config)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [testing, setTesting] = useState(false)
  // 每支 server 的 env 編輯文字（id → 多行 KEY=VALUE），於存檔時解析回物件。
  const [envText, setEnvText] = useState<Record<string, string>>({})
  const [importText, setImportText] = useState('')
  const [importMsg, setImportMsg] = useState<{ ok: boolean; msg: string } | null>(null)
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null)
  const [test, setTest] = useState<{
    ollama: { ok: boolean; msg: string }
    env: EnvCheck | null
    servers: McpServerStatus[]
  } | null>(null)

  // 只在「設定頁可編輯欄位」變動（初次載入、存檔後）時重置 draft；忽略即時設定（外觀／主題／語言）
  // 造成的 config 變動，避免清掉使用者在其他分頁尚未存檔的編輯。
  const draftSigRef = useRef<string>('')
  useEffect(() => {
    if (!config) return
    const sig = JSON.stringify({
      ollamaUrl: config.ollamaUrl,
      model: config.model,
      pythonPath: config.pythonPath,
      dbPath: config.dbPath,
      temperature: config.temperature,
      maxTurns: config.maxTurns,
      mcpServers: config.mcpServers
    })
    if (sig === draftSigRef.current) return
    draftSigRef.current = sig
    setDraft(config)
    const e: Record<string, string> = {}
    for (const s of config.mcpServers) if (s.env) e[s.id] = serializeEnv(s.env)
    setEnvText(e)
  }, [config])

  // 進入「AI 行為」分頁時抓取實際系統提示（語言／工具清單變動後重抓）。
  useEffect(() => {
    if (tab !== 'agent') return
    let alive = true
    setSystemPrompt(null)
    void window.api.getSystemPrompt().then((p) => {
      if (alive) setSystemPrompt(p)
    })
    return () => {
      alive = false
    }
  }, [tab, i18n.language, liveStatus])

  if (!draft) {
    return (
      <div className="flex h-full items-center justify-center text-ink-muted">
        {t('loading')}
      </div>
    )
  }

  const localOk =
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)(:\d+)?\/?$/i.test(
      draft.ollamaUrl.trim()
    )

  const updateServer = (idx: number, patch: Partial<AppConfig['mcpServers'][number]>): void => {
    const next = draft.mcpServers.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    setDraft({ ...draft, mcpServers: next })
  }

  const addServer = (): void => {
    const used = new Set(draft.mcpServers.map((s) => s.id))
    let n = draft.mcpServers.length + 1
    let id = `custom-${n}`
    while (used.has(id)) {
      n += 1
      id = `custom-${n}`
    }
    setDraft({
      ...draft,
      mcpServers: [
        ...draft.mcpServers,
        { id, name: '', scriptPath: '', enabled: true, command: '', args: [] }
      ]
    })
  }

  const removeServer = (idx: number): void => {
    setDraft({ ...draft, mcpServers: draft.mcpServers.filter((_, i) => i !== idx) })
  }

  /** 貼上標準 mcpServers JSON（command/args/env）→ append 成自訂列。 */
  const importFromJson = (): void => {
    try {
      const parsed = JSON.parse(importText) as Record<string, unknown>
      const map = (parsed.mcpServers ?? parsed) as Record<string, { command?: unknown; args?: unknown; env?: unknown }>
      if (!map || typeof map !== 'object') throw new Error('shape')
      const used = new Set(draft.mcpServers.map((s) => s.id))
      let n = draft.mcpServers.length
      const added: McpServerConfig[] = []
      const seededEnv: Record<string, string> = {}
      for (const [name, v] of Object.entries(map)) {
        if (!v || typeof v !== 'object' || !v.command) continue
        n += 1
        let id = `custom-${n}`
        while (used.has(id)) {
          n += 1
          id = `custom-${n}`
        }
        used.add(id)
        const env =
          v.env && typeof v.env === 'object' ? (v.env as Record<string, string>) : undefined
        added.push({
          id,
          name,
          scriptPath: '',
          enabled: true,
          command: String(v.command),
          args: Array.isArray(v.args) ? v.args.map(String) : [],
          env
        })
        if (env) seededEnv[id] = serializeEnv(env)
      }
      if (!added.length) throw new Error('empty')
      setDraft({ ...draft, mcpServers: [...draft.mcpServers, ...added] })
      setEnvText((prev) => ({ ...prev, ...seededEnv }))
      setImportText('')
      setImportMsg({ ok: true, msg: t('mcpImportOk', { count: added.length }) })
    } catch {
      setImportMsg({ ok: false, msg: t('mcpImportFail') })
    }
  }

  const save = async (): Promise<void> => {
    // 把編輯態正規化：command 模式才帶 args/env；args 去空白；env 由文字解析。
    const clamp = (v: number | undefined, lo: number, hi: number, def: number): number => {
      const n = typeof v === 'number' && Number.isFinite(v) ? v : def
      return Math.min(hi, Math.max(lo, n))
    }
    const cleaned: AppConfig = {
      ...draft,
      temperature: clamp(draft.temperature, 0, 1, 0.3),
      maxTurns: Math.round(clamp(draft.maxTurns, 1, 20, 12)),
      mcpServers: draft.mcpServers.map((s) => {
        const command = s.command?.trim() || undefined
        const env = parseEnv(envText[s.id] ?? '')
        return {
          ...s,
          command,
          args: command ? (s.args ?? []).map((a) => a.trim()).filter(Boolean) : undefined,
          env: command && Object.keys(env).length ? env : undefined
        }
      })
    }
    // 存檔前驗證：每支 server 需有名稱、至少一個 command 或 scriptPath，且 id 不重複。
    const ids = cleaned.mcpServers.map((s) => s.id)
    const invalid =
      cleaned.mcpServers.some((s) => !s.name.trim() || (!s.command && !s.scriptPath.trim())) ||
      ids.length !== new Set(ids).size
    if (invalid) {
      useAppStore.getState().pushToast(t('mcpInvalid'), 'info')
      return
    }
    setSaving(true)
    setResult(null)
    try {
      const saved = await window.api.setConfig(cleaned)
      useAppStore.setState({ config: saved })
      const status = await window.api.getMcpStatus()
      setMcpStatus(status)
      setTools(await window.api.listTools())
      // 設定變更後重跑健康檢查，更新標題列狀態列。
      void useAppStore.getState().refreshHealth()
      const connected = status.filter((s) => s.state === 'connected')
      const totalTools = connected.reduce((n, s) => n + s.toolCount, 0)
      const msg =
        connected.length > 0
          ? t('save.ok', { connected: connected.length, total: status.length, tools: totalTools })
          : t('save.partial')
      setResult({ ok: connected.length > 0, msg })
      useAppStore.getState().pushToast(msg, connected.length > 0 ? 'success' : 'info')
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : String(err) })
    } finally {
      setSaving(false)
    }
  }

  /** 連線測試：實際探測 Ollama（列模型）與重新連線各 MCP server。 */
  const runTest = async (): Promise<void> => {
    setTesting(true)
    setTest(null)
    setResult(null)
    // 1) Ollama
    let ollama: { ok: boolean; msg: string }
    try {
      const models = await window.api.listModels()
      const has = models.includes(draft.model)
      ollama = {
        ok: true,
        msg:
          t('test.ollamaOk', { count: models.length }) +
          (has ? '' : t('test.ollamaModelMissing', { model: draft.model }))
      }
    } catch (err) {
      ollama = {
        ok: false,
        msg: t('test.ollamaFail', { error: err instanceof Error ? err.message : String(err) })
      }
    }
    // 2) 環境（DB 檔是否存在、Python 是否可執行）
    let env: EnvCheck | null = null
    try {
      env = await window.api.checkEnvironment()
    } catch (err) {
      console.error('[settings] 環境檢查失敗：', err)
    }
    // 3) MCP servers（實際重新連線以真實探測）
    let servers: McpServerStatus[] = []
    try {
      servers = await window.api.reconnectMcp()
      setMcpStatus(servers)
      setTools(await window.api.listTools())
    } catch (err) {
      console.error('[settings] MCP 測試失敗：', err)
    }
    setTest({ ollama, env, servers })
    setTesting(false)
  }

  // 單一欄位渲染（label + 輸入 + hint + localWarn），供各分組 Section 取用。
  const renderField = (key: FieldKey): React.JSX.Element => {
    const f = FIELDS.find((x) => x.key === key)!
    return (
      <div key={key} className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={key}>{t(`fields.${key}.label`)}</Label>
          <InfoTip contentKey={`help.${key}`} testid={`info-${key}`} />
        </div>
        {key === 'model' ? (
          <ModelSelect value={draft.model} onChange={(v) => setDraft({ ...draft, model: v })} />
        ) : (
          <Input
            id={key}
            value={draft[key]}
            placeholder={f.placeholder}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          />
        )}
        <p className="text-xs text-ink-muted">{t(`fields.${key}.hint`)}</p>
        {key === 'ollamaUrl' && !localOk && (
          <p className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5" />
            {t('localWarn')}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-3">
        <h1 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <SettingsIcon className="h-4 w-4 text-brand" />
          {t('title')}
        </h1>
        <p className="text-xs text-ink-muted">{t('desc')}</p>
      </div>

      {/* 橫向分頁列（固定，不隨內容捲動） */}
      <div className="flex gap-1 border-b border-border px-4 pt-2" role="tablist">
        {SETTINGS_TABS.map((tb) => {
          const Icon = tb.icon
          const active = tab === tb.key
          return (
            <button
              key={tb.key}
              data-testid={`settings-tab-${tb.key}`}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tb.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink'
              )}
            >
              <Icon className="h-4 w-4" />
              {t(`section.${tb.key}`)}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-xl space-y-5">
          {tab === 'inference' && (
            <div className="space-y-4">
              <p className="text-xs text-ink-muted">{t('section.inferenceDesc')}</p>
              {renderField('ollamaUrl')}
              {renderField('model')}
            </div>
          )}

          {tab === 'runtime' && (
            <div className="space-y-4">
              <p className="text-xs text-ink-muted">{t('section.runtimeDesc')}</p>
              {renderField('pythonPath')}
              {renderField('dbPath')}
            </div>
          )}

          {tab === 'agent' && (
            <div className="space-y-4">
              <p className="text-xs text-ink-muted">{t('section.agentDesc')}</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="temperature">{t('agent.temperatureLabel')}</Label>
                  <InfoTip contentKey="help.temperature" testid="info-temperature" />
                </div>
                <Input
                  id="temperature"
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={draft.temperature ?? 0.3}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      temperature: e.target.value === '' ? undefined : Number(e.target.value)
                    })
                  }
                  className="w-28"
                />
                <p className="text-xs text-ink-muted">{t('agent.temperatureHint')}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="maxTurns">{t('agent.maxTurnsLabel')}</Label>
                  <InfoTip contentKey="help.maxTurns" testid="info-maxTurns" />
                </div>
                <Input
                  id="maxTurns"
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  value={draft.maxTurns ?? 12}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      maxTurns: e.target.value === '' ? undefined : Number(e.target.value)
                    })
                  }
                  className="w-28"
                />
                <p className="text-xs text-ink-muted">{t('agent.maxTurnsHint')}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label>{t('agent.systemPromptLabel')}</Label>
                  <InfoTip contentKey="help.systemPrompt" testid="info-systemPrompt" />
                </div>
                <Textarea
                  readOnly
                  rows={12}
                  value={systemPrompt ?? t('agent.systemPromptLoading')}
                  className="font-mono text-[11px] leading-relaxed"
                />
                <p className="text-xs text-ink-muted">{t('agent.systemPromptHint')}</p>
              </div>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="space-y-4">
              <p className="text-xs text-ink-muted">{t('section.appearanceDesc')}</p>

              {/* 字級卡片 */}
              <div className="space-y-4 rounded-xl border border-border bg-card/40 p-5">
                <div className="flex items-center gap-2">
                  <Accessibility className="h-4 w-4 text-brand" />
                  <Label className="text-sm">{t('appearance.fontSize')}</Label>
                  <InfoTip contentKey="help.fontSize" testid="info-fontScale" />
                </div>
                {/* 全寬分段控制 */}
                <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-border">
                  {FONT_SIZES.map((s, i) => {
                    const active = (config?.fontScale ?? 'md') === s
                    return (
                      <button
                        key={s}
                        data-testid={`appearance-font-${s}`}
                        type="button"
                        onClick={() => setFontScale(s)}
                        aria-pressed={active}
                        className={cn(
                          'py-2 text-sm font-medium transition-colors',
                          i > 0 && 'border-l border-border',
                          active
                            ? 'bg-brand text-white shadow-inner'
                            : 'text-ink-muted hover:bg-brand/5 hover:text-ink'
                        )}
                      >
                        {t(`appearance.sizes.${s}`)}
                      </button>
                    )
                  })}
                </div>
                {/* 預覽 */}
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-brand/30 bg-brand/5 px-4 py-3">
                  <span className="shrink-0 rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                    {t('appearance.previewBadge')}
                  </span>
                  <span
                    className="font-medium text-ink"
                    style={{ fontSize: { sm: 14, md: 16, lg: 18, xl: 20 }[config?.fontScale ?? 'md'] }}
                  >
                    {t('appearance.previewText')}
                  </span>
                </div>
              </div>

              {/* 高對比卡片（含切換開關） */}
              {(() => {
                const hc = config?.highContrast ?? false
                return (
                  <button
                    type="button"
                    data-testid="appearance-hc-switch"
                    role="switch"
                    aria-checked={hc}
                    onClick={() => setHighContrast(!hc)}
                    className="flex w-full items-center gap-4 rounded-xl border border-border bg-card/40 p-5 text-left transition-colors hover:border-brand/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{t('appearance.highContrast')}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {t('appearance.highContrastHint')}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                        hc ? 'bg-brand' : 'bg-ink-muted/30'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                          hc ? 'translate-x-[22px]' : 'translate-x-0.5'
                        )}
                      />
                    </span>
                  </button>
                )
              })()}

              <p className="text-center text-xs text-ink-muted">{t('appearance.instantNote')}</p>
            </div>
          )}

          {/* MCP server 清單 */}
          {tab === 'mcp' && (
            <div className="space-y-2">
              <p className="text-xs text-ink-muted">{t('mcpSectionDesc')}</p>
            {draft.mcpServers.map((srv, idx) => {
              const builtin = BUILTIN_IDS.has(srv.id)
              const st = liveStatus.find((s) => s.id === srv.id)
              return (
                <div
                  key={srv.id}
                  className="space-y-2 rounded-md border border-border bg-card/40 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={srv.name}
                      placeholder={t('mcpNamePlaceholder')}
                      aria-label={t('mcpNamePlaceholder')}
                      onChange={(e) => updateServer(idx, { name: e.target.value })}
                      className="min-w-0 flex-1"
                    />
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                        builtin ? 'bg-card text-ink-muted' : 'bg-brand/10 text-brand'
                      )}
                    >
                      {builtin ? t('mcpBuiltin') : t('mcpCustom')}
                    </span>
                    {!builtin && (
                      <button
                        type="button"
                        onClick={() => removeServer(idx)}
                        title={t('mcpRemove')}
                        aria-label={t('mcpRemove')}
                        className="shrink-0 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {builtin ? (
                    <Input
                      value={srv.scriptPath}
                      placeholder="./server.py"
                      aria-label={t('mcpScriptLabel', { name: srv.name || srv.id })}
                      onChange={(e) => updateServer(idx, { scriptPath: e.target.value })}
                    />
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Input
                          value={srv.command ?? ''}
                          placeholder={t('mcpCommandPlaceholder')}
                          aria-label={t('mcpCommand')}
                          onChange={(e) => updateServer(idx, { command: e.target.value })}
                        />
                        <Input
                          value={(srv.args ?? []).join(' ')}
                          placeholder={t('mcpArgsPlaceholder')}
                          aria-label={t('mcpArgs')}
                          onChange={(e) => updateServer(idx, { args: e.target.value.split(' ') })}
                        />
                      </div>
                      <Input
                        value={srv.scriptPath}
                        placeholder="./server.py"
                        aria-label={t('mcpScriptLabel', { name: srv.name || srv.id })}
                        onChange={(e) => updateServer(idx, { scriptPath: e.target.value })}
                      />
                      <Textarea
                        rows={2}
                        value={envText[srv.id] ?? ''}
                        placeholder={t('mcpEnvPlaceholder')}
                        aria-label={t('mcpEnv')}
                        onChange={(e) =>
                          setEnvText((prev) => ({ ...prev, [srv.id]: e.target.value }))
                        }
                        className="font-mono text-xs"
                      />
                      <p className="text-[11px] text-ink-muted">{t('mcpStandardHint')}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <input
                        type="checkbox"
                        checked={srv.enabled}
                        onChange={(e) => updateServer(idx, { enabled: e.target.checked })}
                        className="accent-brand"
                      />
                      {t('enabled')}
                    </label>
                    <ServerStatus enabled={srv.enabled} st={st} />
                  </div>
                  {st?.state === 'connected' && st.serverInfo && (
                    <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-emerald-700">
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                      {t('mcpHandshakeOk')} · {st.serverInfo.name} v{st.serverInfo.version}
                      {st.capabilities && st.capabilities.length > 0
                        ? ` · ${t('mcpCapabilities')}: ${st.capabilities.join(', ')}`
                        : ''}
                      {' · '}
                      {st.schemaValid ? t('mcpSchemaOk') : t('mcpSchemaBad')}
                    </p>
                  )}
                </div>
              )
            })}
            <Button type="button" variant="outline" size="sm" onClick={addServer} className="w-full">
              <Plus className="h-4 w-4" />
              {t('mcpAdd')}
            </Button>
            <p className="text-xs text-ink-muted">{t('mcpBuiltinHint')}</p>

            {/* 匯入標準 mcpServers JSON（command/args/env） */}
            <div className="space-y-1.5 rounded-md border border-dashed border-border p-3">
              <Label className="text-xs">{t('mcpImport')}</Label>
              <Textarea
                data-testid="settings-mcp-import-input"
                rows={3}
                value={importText}
                placeholder={t('mcpImportPlaceholder')}
                onChange={(e) => setImportText(e.target.value)}
                className="font-mono text-[11px]"
              />
              <div className="flex items-center justify-between gap-2">
                <Button
                  data-testid="settings-mcp-import"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={importFromJson}
                  disabled={!importText.trim()}
                >
                  {t('mcpImportBtn')}
                </Button>
                {importMsg && (
                  <span
                    data-testid="settings-mcp-import-msg"
                    data-ok={importMsg.ok}
                    className={cn(
                      'text-xs',
                      importMsg.ok ? 'text-emerald-700' : 'text-red-700'
                    )}
                  >
                    {importMsg.msg}
                  </span>
                )}
              </div>
            </div>
            </div>
          )}

          {/* 連線測試結果 */}
          {test && (
            <div data-testid="settings-test-result" className="space-y-1.5 rounded-md border border-border bg-card/40 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t('test.resultTitle')}
              </div>
              <TestRow testid="settings-test-ollama" ok={test.ollama.ok} label="Ollama" msg={test.ollama.msg} />
              {test.env && (
                <>
                  <TestRow
                    ok={test.env.dbExists}
                    label={t('test.dbLabel')}
                    msg={
                      test.env.dbExists
                        ? t('test.dbExists', { path: test.env.dbAbsPath })
                        : t('test.dbMissing', { path: test.env.dbAbsPath })
                    }
                  />
                  <TestRow
                    ok={test.env.pythonOk}
                    label={t('test.pythonLabel')}
                    msg={
                      test.env.pythonOk
                        ? test.env.pythonInfo
                        : t('test.pythonFail', { info: test.env.pythonInfo })
                    }
                  />
                </>
              )}
              {test.servers.length === 0 && (
                <TestRow ok={false} label="MCP" msg={t('test.mcpNone')} />
              )}
              {test.servers.map((s) => (
                <TestRow
                  key={s.id}
                  ok={s.state === 'connected'}
                  label={s.name}
                  msg={
                    s.state === 'connected'
                      ? t('test.serverConnected', { count: s.toolCount })
                      : s.message || s.state
                  }
                />
              ))}
            </div>
          )}

        </div>
      </div>

      {/* 固定頁尾動作列：捲動時儲存鈕永遠可見 */}
      <div className="border-t border-border bg-surface px-6 py-3">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {result ? (
            <span
              className={cn(
                'flex min-w-0 flex-1 items-center gap-1.5 text-xs',
                result.ok ? 'text-emerald-700' : 'text-amber-700'
              )}
            >
              {result.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">{result.msg}</span>
            </span>
          ) : (
            <div className="flex-1" />
          )}
          <Button data-testid="settings-test" variant="outline" onClick={runTest} disabled={testing || saving}>
            <Activity className={`h-4 w-4 ${testing ? 'animate-pulse' : ''}`} />
            {testing ? t('test.testing') : t('test.btn')}
          </Button>
          <Button data-testid="settings-save" onClick={save} disabled={saving || !localOk}>
            <Save className="h-4 w-4" />
            {saving ? t('save.saving') : t('save.btn')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** 每支 server 的即時連線狀態燈（讀 store 的 mcpServers，存檔/測試後即時更新）。 */
function ServerStatus({
  enabled,
  st
}: {
  enabled: boolean
  st?: McpServerStatus
}): React.JSX.Element {
  const { t } = useTranslation('settings')
  let color = 'text-ink-muted'
  let text = t('mcpPending')
  if (!enabled) {
    text = t('mcpDisabled')
  } else if (st?.state === 'connected') {
    color = 'text-emerald-700'
    text = t('test.serverConnected', { count: st.toolCount })
  } else if (st?.state === 'error') {
    color = 'text-red-700'
    text = st.message || st.state
  } else if (st) {
    text = st.state
  }
  return (
    <span className={cn('flex min-w-0 items-center gap-1.5 text-xs', color)}>
      <Circle className="h-2 w-2 shrink-0 fill-current" />
      <span className="max-w-[14rem] truncate">{text}</span>
    </span>
  )
}

function TestRow({
  ok,
  label,
  msg,
  testid
}: {
  ok: boolean
  label: string
  msg: string
  testid?: string
}): React.JSX.Element {
  return (
    <div data-testid={testid} data-ok={ok} className="flex items-start gap-2 text-sm">
      <Circle
        className={`mt-1 h-2.5 w-2.5 shrink-0 fill-current ${
          ok ? 'text-emerald-600' : 'text-red-600'
        }`}
      />
      <span className="font-medium text-ink">{label}</span>
      <span className="text-ink-muted">— {msg}</span>
    </div>
  )
}

const CUSTOM = '__custom__'

/**
 * 模型選擇：自動偵測本機 Ollama 已安裝模型 → 下拉選單挑選；亦可切換成自訂輸入。
 */
function ModelSelect({
  value,
  onChange
}: {
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  const { t } = useTranslation('settings')
  const [models, setModels] = useState<string[]>([])
  const [detecting, setDetecting] = useState(false)
  const [custom, setCustom] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detect = async (): Promise<void> => {
    setDetecting(true)
    setError(null)
    try {
      const list = await window.api.listModels()
      setModels(list)
      if (list.length === 0) setError(t('model.noModels'))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDetecting(false)
    }
  }

  // 進入設定頁時自動偵測一次。
  useEffect(() => {
    void detect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 下拉選項：偵測到的模型 ∪ 目前值（確保目前值一定看得到）。
  const options = Array.from(new Set([value, ...models].filter(Boolean)))

  if (custom) {
    return (
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <Input
            autoFocus
            value={value}
            placeholder={t('model.customPlaceholder')}
            aria-label={t('model.customPlaceholder')}
            onChange={(e) => onChange(e.target.value)}
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setCustom(false)}
            title={t('model.useListTooltip')}
            className="shrink-0"
          >
            <List className="h-4 w-4" />
            {t('model.listBtn')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <select
          value={value}
          aria-label={t('fields.model.label')}
          onChange={(e) => {
            if (e.target.value === CUSTOM) setCustom(true)
            else onChange(e.target.value)
          }}
          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {options.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          <option value={CUSTOM}>{t('model.customOption')}</option>
        </select>
        <Button
          type="button"
          variant="outline"
          onClick={detect}
          disabled={detecting}
          title={t('model.detectTooltip')}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${detecting ? 'animate-spin' : ''}`} />
          {detecting ? t('model.detecting') : t('model.detect')}
        </Button>
      </div>
      {error ? (
        <p className="flex items-center gap-1 text-xs text-amber-700">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : (
        models.length > 0 && (
          <p className="flex items-center gap-1 text-xs text-ink-muted">
            <Pencil className="h-3 w-3" />
            {t('model.detectedCount', { count: models.length })}
          </p>
        )
      )}
    </div>
  )
}
