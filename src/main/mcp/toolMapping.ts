import { ToolInfo } from '@shared/types'
import type { Tool as OllamaTool } from 'ollama'

// 把 MCP 工具（含 JSON Schema 的 inputSchema）轉成 Ollama tool calling 所需的格式。
export function toOllamaTools(tools: ToolInfo[]): OllamaTool[] {
  return tools.map((t) => {
    const schema = (t.inputSchema ?? {}) as {
      type?: string
      properties?: Record<string, unknown>
      required?: string[]
    }
    return {
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: schema.type ?? 'object',
          properties: (schema.properties ?? {}) as Record<
            string,
            { type: string; description: string }
          >,
          required: schema.required ?? []
        }
      }
    }
  })
}
