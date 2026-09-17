import type { RequestContext } from '../../common/types/request-context';

export interface JsonSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: boolean;
  enum?: Array<string | number | boolean>;
  default?: unknown;
  [key: string]: unknown;
}

/** 工具契约：api.md 的机器可读版本，也是 OpenAI tools 的数据源 */
export interface ToolContract {
  name: string;
  summary: string;
  upstream?: {
    system: string;
    method?: string;
    path?: string;
    mode?: string;
  };
  parameters: JsonSchema;
  /** 明确声明返回结构，供模型理解字段含义 */
  returns: JsonSchema;
  notes?: string[];
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: JsonSchema;
  returns: JsonSchema;
  notes?: string[];
  upstream?: ToolContract['upstream'];
  execute(input: Record<string, unknown>, ctx?: RequestContext): Promise<unknown>;
}

export interface OpenAiToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

/** 把 returns schema 编进 description（OpenAI tools 协议本身不带 returns） */
export function buildToolDescription(tool: {
  description: string;
  returns: JsonSchema;
  notes?: string[];
  upstream?: ToolContract['upstream'];
}): string {
  const parts = [tool.description.trim()];

  if (tool.upstream) {
    const u = tool.upstream;
    parts.push(
      [
        'Upstream:',
        u.system ? `system=${u.system}` : '',
        u.method ? `method=${u.method}` : '',
        u.path ? `path=${u.path}` : '',
        u.mode ? `mode=${u.mode}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  parts.push(
    `Returns JSON matching this schema:\n${JSON.stringify(tool.returns, null, 2)}`,
  );

  if (tool.notes?.length) {
    parts.push(`Notes:\n- ${tool.notes.join('\n- ')}`);
  }

  return parts.join('\n\n');
}

export function toOpenAiTool(tool: AgentTool): OpenAiToolDefinition {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: buildToolDescription(tool),
      parameters: tool.parameters,
    },
  };
}

export function toolFromContract(
  contract: ToolContract,
  execute: (
    input: Record<string, unknown>,
    ctx?: RequestContext,
  ) => Promise<unknown>,
): Omit<AgentTool, 'execute'> & {
  execute: typeof execute;
  upstream?: ToolContract['upstream'];
} {
  return {
    name: contract.name,
    description: contract.summary,
    parameters: contract.parameters,
    returns: contract.returns,
    notes: contract.notes,
    upstream: contract.upstream,
    execute,
  };
}
