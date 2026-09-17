import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createKnowempBridge } from '../../adapter/dsh-bridge.ts'
import { jsonObjectToParams } from './schema.ts'

export const name = 'knowemp-tools'
export const inject = ['tools']

/**
 * Register KnowEmp's 15 read-only business tools into this agent preset.
 * @param ctx - the preset-scoped Cordis context
 */
export function apply(ctx: Context): void {
  const tools = createKnowempBridge({
    requestContext: {
      userId: process.env.TDS_UNION_ID,
    },
  })

  for (const tool of tools) {
    const timeoutMs = tool.name === 'search_knowledge' ? 180_000 : 60_000
    ctx.tools.register(defineTool({
      name: tool.name,
      description: tool.description,
      parameters: jsonObjectToParams(tool.parameters),
      timeoutMs,
      output: {
        schema: { type: 'json' },
        render(_args, value) {
          return [{ type: 'text', text: stringify(value) }]
        },
      },
      async execute(args) {
        return toLosslessJson(await tool.execute(args as Record<string, unknown>)) as never
      },
    }))
  }
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? 'null'
  } catch {
    return String(value)
  }
}

/** DSH tool output must be lossless JSON. Optional KnowEmp fields are often `undefined`. */
function toLosslessJson(value: unknown): unknown {
  if (value === undefined) return null
  try {
    return JSON.parse(JSON.stringify(value)) as unknown
  } catch (error) {
    return {
      error: 'tool_result_not_json',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
