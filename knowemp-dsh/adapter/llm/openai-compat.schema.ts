import type {
  JsonSchema,
  OpenAiToolDefinition,
} from '../agent/tools/tool.types';

/**
 * vLLM guided decoding 会被 `additionalProperties: false` 和 `type: ["string","null"]`
 * 打成 HTTP 500。公司 Qwen 出站前把 schema 收成它能吃的子集。
 */
export function sanitizeJsonSchemaForVllm(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = { ...schema };
  if (out.additionalProperties === false) {
    delete out.additionalProperties;
  }
  if (Array.isArray(out.type)) {
    const nonNull = out.type.filter((item) => item !== 'null');
    if (nonNull.length === 1) {
      out.type = nonNull[0];
    } else if (nonNull.length > 1) {
      out.type = nonNull;
    }
  }
  if (out.properties) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([key, value]) => [
        key,
        sanitizeJsonSchemaForVllm(value),
      ]),
    );
  }
  if (out.items) {
    out.items = sanitizeJsonSchemaForVllm(out.items);
  }
  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    const list = out[key];
    if (Array.isArray(list)) {
      out[key] = list.map((item) =>
        item && typeof item === 'object'
          ? sanitizeJsonSchemaForVllm(item as JsonSchema)
          : item,
      );
    }
  }
  return out;
}

export function sanitizeToolsForVllm(
  tools: OpenAiToolDefinition[],
): OpenAiToolDefinition[] {
  return tools.map((tool) => ({
    ...tool,
    function: {
      ...tool.function,
      parameters: sanitizeJsonSchemaForVllm(tool.function.parameters),
    },
  }));
}
