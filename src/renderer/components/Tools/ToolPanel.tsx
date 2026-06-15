import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Wrench, RefreshCw, Circle, Server, Settings } from 'lucide-react'
import { McpConnState, ToolInfo } from '@shared/types'
import { useState } from 'react'

const stateColor: Record<McpConnState, string> = {
  connected: 'text-emerald-600',
  connecting: 'text-amber-500',
  disconnected: 'text-ink-muted',
  error: 'text-red-600'
}

export function ToolPanel(): React.JSX.Element {
  const { t } = useTranslation('tools')
  const tools = useAppStore((s) => s.tools)
  const mcpServers = useAppStore((s) => s.mcpServers)
  const setMcpStatus = useAppStore((s) => s._setMcpStatus)
  const setTools = useAppStore((s) => s._setTools)
  const setView = useAppStore((s) => s.setView)
  const [reconnecting, setReconnecting] = useState(false)

  const pushToast = useAppStore((s) => s.pushToast)

  const reconnect = async (): Promise<void> => {
    setReconnecting(true)
    try {
      const status = await window.api.reconnectMcp()
      setMcpStatus(status)
      setTools(await window.api.listTools())
      const connected = status.filter((s) => s.state === 'connected').length
      pushToast(
        t('toast.reconnected', { connected, total: status.length, count: status.length }),
        connected > 0 ? 'success' : 'info'
      )
    } finally {
      setReconnecting(false)
    }
  }

  const toolsByServer = (id: string): ToolInfo[] =>
    tools.filter((tool) => tool.serverId === id)

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
        >
          <RefreshCw className={`h-4 w-4 ${reconnecting ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        {mcpServers.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-1 py-8 text-center text-xs text-ink-muted">
            <span className="max-w-xs">{t('emptyServers')}</span>
            <Button variant="outline" size="sm" onClick={() => setView('settings')}>
              <Settings className="h-3.5 w-3.5" />
              {t('health:openSettings')}
            </Button>
          </div>
        )}

        {mcpServers.map((srv) => {
          const color = stateColor[srv.state]
          const srvTools = toolsByServer(srv.id)
          return (
            <div key={srv.id} className="rounded-md border border-border">
              {/* server 標頭 */}
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
                {srvTools.map((tool) => {
                  const props = (tool.inputSchema?.properties as Record<string, unknown>) ?? {}
                  const paramNames = Object.keys(props)
                  return (
                    <div key={tool.name} className="rounded border border-border bg-surface p-2.5">
                      <div className="font-mono text-xs font-semibold text-brand">{tool.name}</div>
                      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                        {tool.description || t('noDesc')}
                      </p>
                      {paramNames.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {paramNames.map((p) => (
                            <Badge
                              key={p}
                              className="bg-card font-mono text-[10px] text-ink-muted ring-1 ring-border"
                            >
                              {p}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
