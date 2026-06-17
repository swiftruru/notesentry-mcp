import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { Input } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Wrench, RefreshCw, Circle, Server, Settings, Search, Database } from 'lucide-react'
import { McpConnState, ToolInfo } from '@shared/types'
import { MIMIC_NOTES_COLUMNS } from './mimicSchema'

const stateColor: Record<McpConnState, string> = {
  connected: 'text-emerald-700',
  connecting: 'text-amber-600',
  disconnected: 'text-ink-muted',
  error: 'text-red-700'
}

type Tab = 'catalog' | 'schema'

interface SchemaProp {
  type?: unknown
  description?: string
  anyOf?: { type?: string }[]
  items?: { type?: string }
}

/** 由 JSON Schema 屬性推導可讀型別：處理選填的 anyOf:[T,null] 與陣列 array<item>。 */
function typeLabel(meta: SchemaProp): string {
  if (typeof meta.type === 'string') {
    if (meta.type === 'array' && meta.items?.type) return `array<${meta.items.type}>`
    return meta.type
  }
  if (Array.isArray(meta.anyOf)) {
    const types = meta.anyOf
      .map((a) => a?.type)
      .filter((x): x is string => typeof x === 'string' && x !== 'null')
    if (types.length) return types.join(' | ')
  }
  return '—'
}

export function ToolPanel(): React.JSX.Element {
  const { t } = useTranslation('tools')
  const tools = useAppStore((s) => s.tools)
  const mcpServers = useAppStore((s) => s.mcpServers)
  const setView = useAppStore((s) => s.setView)
  const reconnectMcp = useAppStore((s) => s.reconnectMcp)
  const [reconnecting, setReconnecting] = useState(false)
  const [tab, setTab] = useState<Tab>('catalog')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const reconnect = async (): Promise<void> => {
    setReconnecting(true)
    try {
      await reconnectMcp()
    } finally {
      setReconnecting(false)
    }
  }

  const propsOf = (tool: ToolInfo): Record<string, SchemaProp> =>
    (tool.inputSchema?.properties as Record<string, SchemaProp>) ?? {}
  const requiredOf = (tool: ToolInfo): string[] =>
    Array.isArray(tool.inputSchema?.required) ? (tool.inputSchema!.required as string[]) : []

  const matchTool = (tool: ToolInfo): boolean => {
    if (!q) return true
    const props = propsOf(tool)
    return (
      tool.name.toLowerCase().includes(q) ||
      (tool.description ?? '').toLowerCase().includes(q) ||
      Object.entries(props).some(
        ([p, meta]) =>
          p.toLowerCase().includes(q) || (meta.description ?? '').toLowerCase().includes(q)
      )
    )
  }

  const schemaRows = MIMIC_NOTES_COLUMNS.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || t(`schema.col.${c.name}`).toLowerCase().includes(q)
  )

  // 工具目錄：依 server 分組，並套用搜尋過濾。
  const catalogGroups = mcpServers
    .map((srv) => ({ srv, srvTools: tools.filter((tl) => tl.serverId === srv.id).filter(matchTool) }))
    .filter(({ srvTools }) => !q || srvTools.length > 0)
  const catalogEmpty = q !== '' && catalogGroups.length === 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Wrench className="h-4 w-4 text-brand" />
          {t('title')}
          <span className="text-xs font-normal text-ink-muted">
            {t('summary', { servers: mcpServers.length, tools: tools.length })}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={reconnect}
          disabled={reconnecting}
          title={t('reconnectTooltip')}
          aria-label={t('reconnectTooltip')}
        >
          <RefreshCw className={`h-4 w-4 ${reconnecting ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* 分頁切換 */}
      <div className="flex gap-1 border-b border-border px-4">
        <TabButton testid="tools-tab-catalog" active={tab === 'catalog'} onClick={() => setTab('catalog')}>
          <Wrench className="h-3.5 w-3.5" />
          {t('tabs.catalog')}
        </TabButton>
        <TabButton testid="tools-tab-schema" active={tab === 'schema'} onClick={() => setTab('schema')}>
          <Database className="h-3.5 w-3.5" />
          {t('tabs.schema')}
        </TabButton>
      </div>

      {/* 搜尋 */}
      <div className="px-3 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
          <Input
            data-testid="tools-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div tabIndex={0} className="flex-1 space-y-3 overflow-y-auto px-3 pb-3 pt-2">
        {tab === 'catalog' ? (
          <>
            {mcpServers.length === 0 && (
              <div className="flex flex-col items-center gap-3 px-1 py-8 text-center text-xs text-ink-muted">
                <span className="max-w-xs">{t('emptyServers')}</span>
                <Button variant="outline" size="sm" onClick={() => setView('settings')}>
                  <Settings className="h-3.5 w-3.5" />
                  {t('health:openSettings')}
                </Button>
              </div>
            )}
            {catalogEmpty && (
              <div className="px-1 py-8 text-center text-xs text-ink-muted">{t('noMatch')}</div>
            )}
            {catalogGroups.map(({ srv, srvTools }) => {
              const color = stateColor[srv.state]
              return (
                <div key={srv.id} className="rounded-md border border-border">
                  <div className="flex items-center justify-between rounded-t-md bg-card/70 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                      <Server className="h-3.5 w-3.5 text-brand" />
                      {srv.name}
                    </div>
                    <div className="flex items-center gap-1 text-[11px]">
                      <Circle className={`h-2 w-2 fill-current ${color}`} />
                      <span className={color}>{t(`state.${srv.state}`)}</span>
                    </div>
                  </div>

                  {srv.state === 'error' && srv.message && (
                    <div className="mx-2 mt-2 rounded bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                      {srv.message}
                    </div>
                  )}

                  <div className="space-y-1.5 p-2">
                    {srvTools.length === 0 && srv.state !== 'error' && (
                      <div className="px-1 py-2 text-center text-[11px] text-ink-muted">
                        {t('noTools')}
                      </div>
                    )}
                    {srvTools.map((tool) => (
                      <ToolCard
                        key={tool.name}
                        tool={tool}
                        props={propsOf(tool)}
                        required={requiredOf(tool)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        ) : (
          <div className="rounded-md border border-border">
            <div className="flex items-center gap-1.5 rounded-t-md bg-card/70 px-3 py-2 text-xs font-semibold text-ink">
              <Database className="h-3.5 w-3.5 text-brand" />
              {t('schema.title')}
            </div>
            <p className="px-3 pt-2 text-[11px] leading-relaxed text-ink-muted">{t('schema.intro')}</p>
            <div className="p-2">
              {schemaRows.length === 0 ? (
                <div className="px-1 py-6 text-center text-[11px] text-ink-muted">{t('noMatch')}</div>
              ) : (
                <table data-testid="tools-schema-table" className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr>
                      <Th>{t('schema.cols.name')}</Th>
                      <Th>{t('schema.cols.type')}</Th>
                      <Th>{t('schema.cols.desc')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {schemaRows.map((c) => (
                      <tr key={c.name}>
                        <Td className="font-mono text-brand">{c.name}</Td>
                        <Td className="font-mono text-ink-muted">{c.type}</Td>
                        <Td className="text-ink">{t(`schema.col.${c.name}`)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ToolCard({
  tool,
  props,
  required
}: {
  tool: ToolInfo
  props: Record<string, SchemaProp>
  required: string[]
}): React.JSX.Element {
  const { t } = useTranslation('tools')
  const paramNames = Object.keys(props)
  return (
    <div className="rounded border border-border bg-surface p-2.5">
      <div className="font-mono text-xs font-semibold text-brand">{tool.name}</div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
        {tool.description || t('noDesc')}
      </p>
      {paramNames.length === 0 ? (
        <div className="mt-1.5 text-[11px] text-ink-muted">{t('param.noParams')}</div>
      ) : (
        <table className="mt-1.5 w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <Th>{t('param.name')}</Th>
              <Th>{t('param.type')}</Th>
              <Th>{t('param.required')}</Th>
              <Th>{t('param.desc')}</Th>
            </tr>
          </thead>
          <tbody>
            {paramNames.map((p) => {
              const meta = props[p] ?? {}
              return (
                <tr key={p}>
                  <Td className="font-mono text-ink">{p}</Td>
                  <Td className="font-mono text-ink-muted">{typeLabel(meta)}</Td>
                  <Td className="text-ink-muted">{required.includes(p) ? t('param.yes') : t('param.no')}</Td>
                  <Td className="text-ink-muted">{meta.description || t('noDesc')}</Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
  testid
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  testid?: string
}): React.JSX.Element {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-medium transition-colors',
        active ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink'
      )}
    >
      {children}
    </button>
  )
}

function Th({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <th className="border border-border bg-card px-2 py-1 text-left font-semibold text-brand">
      {children}
    </th>
  )
}

function Td({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return <td className={cn('border border-border px-2 py-1 align-top', className)}>{children}</td>
}
