import type {
  ParameterPropertySpec,
  ParameterSchemaSpec,
  ValueSchemaSpec,
} from '@deepseek-ai/dsh-tools'

/** Convert a KnowEmp JSON Schema object into the defineTool parameter map. */
export function jsonObjectToParams(schema: Record<string, unknown>): ParameterSchemaSpec {
  const properties = isRecord(schema.properties) ? schema.properties : {}
  const required = new Set(Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === 'string') : [])
  const out: ParameterSchemaSpec = {}
  for (const [key, node] of Object.entries(properties)) {
    if (!isRecord(node)) continue
    const spec = jsonNodeToValue(node)
    out[key] = required.has(key) ? { ...spec, required: true } : spec
  }
  return out
}

function jsonNodeToValue(node: Record<string, unknown>): ParameterPropertySpec {
  const description = typeof node.description === 'string' ? node.description : undefined
  const rawType = Array.isArray(node.type)
    ? node.type.find((item): item is string => item === 'string' || item === 'number' || item === 'integer' || item === 'boolean' || item === 'object' || item === 'array')
    : typeof node.type === 'string' ? node.type : undefined

  if (rawType === 'string') {
    return {
      type: 'string',
      ...description ? { description } : {},
      ...stringEnum(node.enum),
      ...copyDefault(node),
    }
  }
  if (rawType === 'number' || rawType === 'integer') {
    return {
      type: rawType,
      ...description ? { description } : {},
      ...numberEnum(node.enum),
      ...copyDefault(node),
    }
  }
  if (rawType === 'boolean') {
    return {
      type: 'boolean',
      ...description ? { description } : {},
      ...copyDefault(node),
    }
  }
  if (rawType === 'array') {
    const items = isRecord(node.items) ? jsonNodeToValue(node.items) : undefined
    return {
      type: 'array',
      ...description ? { description } : {},
      ...items ? { items } : {},
    }
  }
  if (rawType === 'object') {
    return {
      type: 'object',
      additionalProperties: node.additionalProperties !== false,
      ...description ? { description } : {},
      properties: jsonObjectToParams(node),
    }
  }
  return { type: 'json', ...description ? { description } : {} }
}

function stringEnum(value: unknown): Pick<ValueSchemaSpec, never> & { enum?: readonly string[] } {
  if (!Array.isArray(value) || value.length === 0) return {}
  if (!value.every((item): item is string => typeof item === 'string')) return {}
  return { enum: value }
}

function numberEnum(value: unknown): { enum?: readonly number[] } {
  if (!Array.isArray(value) || value.length === 0) return {}
  if (!value.every((item): item is number => typeof item === 'number')) return {}
  return { enum: value }
}

function copyDefault(node: Record<string, unknown>): { default?: string | number | boolean | null } {
  const value = node.default
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return { default: value }
  }
  return {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
