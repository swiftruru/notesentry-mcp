import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ToolInfo, McpServerStatus, McpServerConfig } from '@shared/types'
import { loadConfig } from '../config/configStore'
import { resolveDataPath, resolveResourcePath } from '../paths'
import { tMain } from '../i18n'

// 管理「多個」Python MCP server 子行程的連線（對應簡報的多 MCP 架構）。
interface Connection {
  config: McpServerConfig
  client: Client | null
  transport: StdioClientTransport | null
  tools: ToolInfo[]
  status: McpServerStatus
}

const connections = new Map<string, Connection>()
// 工具名 → serverId 的路由表（工具呼叫時用來找對的 server）
const toolRoute = new Map<string, string>()

type StatusListener = (s: McpServerStatus[]) => void
const statusListeners = new Set<StatusListener>()

export function onMcpStatus(cb: StatusListener): () => void {
  statusListeners.add(cb)
  return () => statusListeners.delete(cb)
}

function emitStatus(): void {
  const arr = getMcpStatus()
  for (const cb of statusListeners) {
    try {
      cb(arr)
    } catch {
      /* ignore */
    }
  }
}

/** 依設定順序回傳每支 server 的連線狀態。 */
export function getMcpStatus(): McpServerStatus[] {
  const cfg = loadConfig()
  return cfg.mcpServers
    .filter((s) => s.enabled)
    .map((s) => connections.get(s.id)?.status ?? {
      id: s.id,
      name: s.name,
      state: 'disconnected' as const,
      toolCount: 0
    })
}

/** 所有 server 的工具攤平成一個清單（每個工具帶 serverId / serverName）。 */
export function getTools(): ToolInfo[] {
  const out: ToolInfo[] = []
  for (const conn of connections.values()) out.push(...conn.tools)
  return out
}

/** 工具的 inputSchema 是否為有效的物件式 JSON Schema（MCP 標準要求 object schema）。 */
function isObjectSchema(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') return false
  const s = schema as Record<string, unknown>
  return s.type === 'object' || 'properties' in s
}

async function connectOne(config: McpServerConfig, dbPath: string): Promise<void> {
  // 先關掉同 id 的舊連線。
  await closeOne(config.id)

  const conn: Connection = {
    config,
    client: null,
    transport: null,
    tools: [],
    status: { id: config.id, name: config.name, state: 'connecting', toolCount: 0 }
  }
  connections.set(config.id, conn)
  emitStatus()

  try {
    const baseEnv = process.env as Record<string, string>
    // 有 command → 標準 MCP 啟動（command/args/env，與 mcp.json 同義）；否則回退 python <scriptPath>。
    const useStandard = !!config.command?.trim()
    const transport = new StdioClientTransport(
      useStandard
        ? {
            command: config.command!.trim(),
            args: config.args ?? [],
            // 仍注入 MIMIC_DB_PATH 以便相容；使用者自訂 env 優先。
            env: { ...baseEnv, MIMIC_DB_PATH: dbPath, ...(config.env ?? {}) },
            stderr: 'pipe'
          }
        : {
            command: loadConfig().pythonPath,
            // 腳本是內附唯讀資源（打包後在 resourcesPath；開發在專案根）。
            args: [resolveResourcePath(config.scriptPath)],
            env: { ...baseEnv, MIMIC_DB_PATH: dbPath, PYTHONUNBUFFERED: '1' },
            stderr: 'pipe'
          }
    )
    const client = new Client({ name: 'notesentry', version: '0.1.0' }, { capabilities: {} })
    await client.connect(transport)

    const result = await client.listTools()
    const tools: ToolInfo[] = (result.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: (t.inputSchema as Record<string, unknown>) ?? {
        type: 'object',
        properties: {}
      },
      serverId: config.id,
      serverName: config.name
    }))

    // MCP 一致性檢查：擷取握手回報的 server 實作、宣告能力，並驗證工具 schema。
    const impl = client.getServerVersion()
    const caps = client.getServerCapabilities()
    const serverInfo = impl ? { name: impl.name, version: impl.version } : undefined
    const capabilities = caps ? Object.keys(caps) : []
    const schemaValid = tools.every((t) => isObjectSchema(t.inputSchema))

    conn.client = client
    conn.transport = transport
    conn.tools = tools
    conn.status = {
      id: config.id,
      name: config.name,
      state: 'connected',
      toolCount: tools.length,
      serverInfo,
      capabilities,
      schemaValid
    }
    for (const t of tools) toolRoute.set(t.name, config.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[mcp:${config.id}] 連線失敗：`, message)
    conn.tools = []
    conn.status = { id: config.id, name: config.name, state: 'error', toolCount: 0, message }
  }
  emitStatus()
}

async function closeOne(id: string): Promise<void> {
  const conn = connections.get(id)
  if (!conn) return
  for (const t of conn.tools) toolRoute.delete(t.name)
  try {
    if (conn.client) await conn.client.close()
  } catch {
    /* ignore */
  }
  try {
    if (conn.transport) await conn.transport.close()
  } catch {
    /* ignore */
  }
}

/** 連上所有「已啟用」的 MCP server。 */
export async function connectMcp(): Promise<McpServerStatus[]> {
  await disconnectMcp()
  const cfg = loadConfig()
  // DB 是使用者資料（打包後預設在 userData；可於設定填絕對路徑）。
  const dbPath = resolveDataPath(cfg.dbPath)
  const enabled = cfg.mcpServers.filter((s) => s.enabled)
  // 並行連線各 server。
  await Promise.all(enabled.map((s) => connectOne(s, dbPath)))
  return getMcpStatus()
}

export async function disconnectMcp(): Promise<void> {
  for (const id of Array.from(connections.keys())) await closeOne(id)
  connections.clear()
  toolRoute.clear()
}

/** 依工具名路由到對的 server 並呼叫，回傳純文字結果。 */
export async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const serverId = toolRoute.get(name)
  const conn = serverId ? connections.get(serverId) : undefined
  if (!conn || !conn.client) throw new Error(tMain('main.error.toolServerNotFound', { name }))

  const res = await conn.client.callTool({ name, arguments: args })
  const content = (res.content as Array<{ type: string; text?: string }>) ?? []
  const text = content
    .map((c) => (c.type === 'text' && c.text ? c.text : JSON.stringify(c)))
    .join('\n')
  if (res.isError) throw new Error(text || tMain('main.error.toolError'))
  return text
}
