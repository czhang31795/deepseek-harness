import { Logger } from '../../../nest-shim.ts'

interface JsonRpcError {
  code?: number;
  message?: string;
}

interface JsonRpcEnvelope {
  jsonrpc?: string;
  id?: unknown;
  result?: unknown;
  error?: JsonRpcError;
}

interface McpHttpResult {
  sessionId?: string;
  text: string;
  status: number;
}

const DEFAULT_POOL_SIZE = 8;
const MAX_POOL_SIZE = 16;

export class TdsMcpTransport {
  private readonly logger = new Logger(TdsMcpTransport.name);
  private readonly poolSize: number;
  private readonly idle: TdsMcpSession[] = [];
  private created = 0;
  private readonly waiters: Array<() => void> = [];

    private readonly mcpUrl: string
  constructor(
    mcpUrl: string,
    options: { poolSize?: number } = {}
  ) {
    this.mcpUrl = mcpUrl

    this.poolSize = clampPoolSize(options.poolSize);
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
    unionId?: string,
  ): Promise<unknown> {
    const session = await this.acquire();
    let discard = false;
    try {
      return await session.callTool(name, args, unionId);
    } catch (error) {
      discard = !session.ready;
      throw error;
    } finally {
      this.release(session, discard);
    }
  }

  private async acquire(): Promise<TdsMcpSession> {
    for (;;) {
      const idle = this.idle.pop();
      if (idle) return idle;
      if (this.created < this.poolSize) {
        this.created += 1;
        return new TdsMcpSession(this.mcpUrl, this.logger);
      }
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
  }

  private release(session: TdsMcpSession, discard: boolean): void {
    if (discard || !session.ready) {
      this.created = Math.max(0, this.created - 1);
    } else {
      this.idle.push(session);
    }
    const waiter = this.waiters.shift();
    if (waiter) waiter();
  }
}

class TdsMcpSession {
  private sessionId?: string;
  private nextId = 1;

    private readonly mcpUrl: string
  private readonly logger: Logger
  constructor(
    mcpUrl: string,
    logger: Logger
  ) {
    this.mcpUrl = mcpUrl
    this.logger = logger
}

  get ready(): boolean {
    return Boolean(this.sessionId);
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
    unionId?: string,
  ): Promise<unknown> {
    await this.ensureSession();
    try {
      return await this.toolsCall(name, args, unionId);
    } catch (error) {
      if (!isLostSession(error)) throw error;
      this.sessionId = undefined;
      await this.ensureSession();
      return this.toolsCall(name, args, unionId);
    }
  }

  private async ensureSession(): Promise<void> {
    if (!this.sessionId) await this.initialize();
  }

  private async initialize(): Promise<void> {
    const res = await this.post(
      {
        jsonrpc: '2.0',
        id: this.nextId++,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'knowemp', version: '0.0.1' },
        },
      },
      {},
    );
    const rpc = parseJsonRpc(res.text);
    if (rpc.error) {
      throw new Error(rpc.error.message || 'TDS MCP initialize 失败');
    }
    const sessionId = res.sessionId;
    if (!sessionId) {
      throw new Error('TDS MCP initialize 未返回 mcp-session-id');
    }
    this.sessionId = sessionId;
    await this.post(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { 'mcp-session-id': sessionId },
    );
    this.logger.log(`TDS MCP session ${sessionId}`);
  }

  private async toolsCall(
    name: string,
    args: Record<string, unknown>,
    unionId?: string,
  ): Promise<unknown> {
    const sessionId = this.sessionId;
    if (!sessionId) {
      throw new Error('TDS MCP 尚未初始化 session');
    }
    const extra: Record<string, string> = {
      'mcp-session-id': sessionId,
    };
    if (unionId) extra['x-union-id'] = unionId;
    const rpc = parseJsonRpc(
      (
        await this.post(
          {
            jsonrpc: '2.0',
            id: this.nextId++,
            method: 'tools/call',
            params: { name, arguments: args },
          },
          extra,
        )
      ).text,
    );
    if (rpc.error) {
      throw new Error(rpc.error.message || 'TDS MCP tools/call 失败');
    }
    return unwrapToolPayload(rpc.result);
  }

  private async post(
    body: Record<string, unknown>,
    extraHeaders: Record<string, string>,
  ): Promise<McpHttpResult> {
    const res = await fetch(this.mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2025-11-25',
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (res.status === 400 && /session/i.test(text)) {
      throw new Error('TDS MCP session 失效');
    }
    if (!res.ok) {
      throw new Error(`TDS MCP HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return {
      status: res.status,
      sessionId: res.headers.get('mcp-session-id') ?? undefined,
      text,
    };
  }
}

export function clampPoolSize(value?: number): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_POOL_SIZE;
  return Math.min(MAX_POOL_SIZE, Math.max(1, Math.trunc(value)));
}

function parseJsonRpc(text: string): JsonRpcEnvelope {
  const payload = parsePossiblySse(text);
  if (!payload || typeof payload !== 'object') {
    throw new Error('TDS MCP 返回不是 JSON-RPC');
  }
  return payload as JsonRpcEnvelope;
}

function parsePossiblySse(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }
  const dataLine = trimmed
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('data:'));
  if (!dataLine) {
    throw new Error(`TDS MCP 无法解析响应: ${trimmed.slice(0, 120)}`);
  }
  return JSON.parse(dataLine.slice(5).trim());
}

function unwrapToolPayload(result: unknown): unknown {
  if (!result || typeof result !== 'object') return result;
  const rec = result as {
    isError?: boolean;
    content?: Array<{ type?: string; text?: string }>;
  };
  if (rec.isError) {
    const text = rec.content?.find((item) => item.type === 'text')?.text;
    throw new Error(text || 'TDS MCP tool 返回 isError');
  }
  const text = rec.content?.find((item) => item.type === 'text')?.text;
  if (text == null) return result;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isLostSession(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /session/i.test(message);
}
