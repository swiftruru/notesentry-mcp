import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/primitives'
import { AppConfig, McpServerStatus, EnvCheck } from '@shared/types'
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
  Circle
} from 'lucide-react'

type FieldKey = 'ollamaUrl' | 'model' | 'pythonPath' | 'dbPath'

// label/hint 由 i18n 提供；placeholder 為實際值範例，不翻譯。
const FIELDS: { key: FieldKey; placeholder: string }[] = [
  { key: 'ollamaUrl', placeholder: 'http://localhost:11434' },
  { key: 'model', placeholder: 'qwen2.5' },
  { key: 'pythonPath', placeholder: 'python3' },
  { key: 'dbPath', placeholder: './mimic_notes.db' }
]

export function SettingsView(): React.JSX.Element {
  const { t } = useTranslation('settings')
  const config = useAppStore((s) => s.config)
  const setMcpStatus = useAppStore((s) => s._setMcpStatus)
  const setTools = useAppStore((s) => s._setTools)
  const [draft, setDraft] = useState<AppConfig | null>(config)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<{
    ollama: { ok: boolean; msg: string }
    env: EnvCheck | null
    servers: McpServerStatus[]
  } | null>(null)

  useEffect(() => {
    setDraft(config)
  }, [config])

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

  const save = async (): Promise<void> => {
    setSaving(true)
    setResult(null)
    try {
      const saved = await window.api.setConfig(draft)
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

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-3">
        <h1 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <SettingsIcon className="h-4 w-4 text-brand" />
          {t('title')}
        </h1>
        <p className="text-xs text-ink-muted">{t('desc')}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-xl space-y-5">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key}>{t(`fields.${f.key}.label`)}</Label>
              {f.key === 'model' ? (
                <ModelSelect
                  value={draft.model}
                  onChange={(v) => setDraft({ ...draft, model: v })}
                />
              ) : (
                <Input
                  id={f.key}
                  value={draft[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                />
              )}
              <p className="text-xs text-ink-muted">{t(`fields.${f.key}.hint`)}</p>
              {f.key === 'ollamaUrl' && !localOk && (
                <p className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {t('localWarn')}
                </p>
              )}
            </div>
          ))}

          {/* MCP server 清單 */}
          <div className="space-y-2 pt-2">
            <Label className="flex items-center gap-1.5">
              <Server className="h-4 w-4 text-brand" />
              {t('mcpSection')}
            </Label>
            <p className="text-xs text-ink-muted">{t('mcpSectionDesc')}</p>
            {draft.mcpServers.map((srv, idx) => (
              <div
                key={srv.id}
                className="space-y-2 rounded-md border border-border bg-card/40 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{srv.name}</span>
                  <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={srv.enabled}
                      onChange={(e) => updateServer(idx, { enabled: e.target.checked })}
                      className="accent-brand"
                    />
                    {t('enabled')}
                  </label>
                </div>
                <Input
                  value={srv.scriptPath}
                  placeholder="./server.py"
                  onChange={(e) => updateServer(idx, { scriptPath: e.target.value })}
                />
              </div>
            ))}
          </div>

          {/* 連線測試結果 */}
          {test && (
            <div className="space-y-1.5 rounded-md border border-border bg-card/40 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t('test.resultTitle')}
              </div>
              <TestRow ok={test.ollama.ok} label="Ollama" msg={test.ollama.msg} />
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

          {result && (
            <div
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {result.ok ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {result.msg}
            </div>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={runTest} disabled={testing || saving}>
              <Activity className={`h-4 w-4 ${testing ? 'animate-pulse' : ''}`} />
              {testing ? t('test.testing') : t('test.btn')}
            </Button>
            <Button onClick={save} disabled={saving || !localOk}>
              <Save className="h-4 w-4" />
              {saving ? t('save.saving') : t('save.btn')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TestRow({
  ok,
  label,
  msg
}: {
  ok: boolean
  label: string
  msg: string
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-2 text-sm">
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
        <p className="flex items-center gap-1 text-xs text-amber-600">
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
