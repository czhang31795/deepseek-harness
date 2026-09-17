import { Logger, ConfigService } from '../../../nest-shim.ts'
import type { RequestContext } from '../../../common/types/request-context';
import {
  tdsMcpArguments,
  tdsMcpToolName,
  unwrapTdsServePayload,
} from './tds-mcp.mapping';
import { clampPoolSize, TdsMcpTransport } from './tds-mcp.transport';

export class TdsClient {
  private readonly logger = new Logger(TdsClient.name);
  private readonly baseUrl: string;
  private readonly defaultUnionId?: string;
  private readonly mcp: TdsMcpTransport;
  private readonly deptCache = new Map<string, { dept: string; at: number }>();
  private static readonly DEPT_TTL_MS = 10 * 60 * 1000;

    private readonly config: ConfigService
  constructor(
    config: ConfigService
  ) {
    this.config = config

    this.baseUrl = (
      this.config.get<string>('TDS_BASE_URL') ?? 'http://172.16.28.79'
    ).replace(/\/$/, '');
    this.defaultUnionId = this.config.get<string>('TDS_UNION_ID') || undefined;
    const mcpUrl = (
      this.config.get<string>('TDS_MCP_URL') ?? 'http://127.0.0.1:3988/mcp'
    ).replace(/\/$/, '');
    const poolSize = clampPoolSize(
      Number.parseInt(this.config.get<string>('TDS_MCP_POOL_SIZE') ?? '', 10),
    );
    this.mcp = new TdsMcpTransport(mcpUrl, { poolSize });
    this.logger.log(`TDS MCP ${mcpUrl} pool=${poolSize}`);
  }

  get origin(): string {
    return this.baseUrl;
  }

  resolveUnionId(ctx: RequestContext = {}): string | undefined {
    const fromCtx = ctx.userId?.trim();
    if (fromCtx) return fromCtx;
    const fromEnv = this.defaultUnionId?.trim();
    return fromEnv || undefined;
  }

  async lookupPkDept(unionId?: string): Promise<string | undefined> {
    const id = String(unionId ?? '').trim();
    if (!id) return undefined;
    const cached = this.deptCache.get(id);
    if (cached && Date.now() - cached.at < TdsClient.DEPT_TTL_MS) {
      return cached.dept || undefined;
    }
    try {
      const res = await fetch(`${this.baseUrl}/tds/serve/system`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-union-id': id,
          union_id: id,
        },
        body: JSON.stringify({ mode: 'getUserInfo', name: id }),
      });
      const json: unknown = await res.json();
      const data = unwrapTdsServePayload<{
        list?: Array<{ union_id?: string; pkDept?: string }>;
      }>(json, 'getUserInfo');
      const list = Array.isArray(data.list) ? data.list : [];
      const row = list.find((item) => String(item.union_id ?? '').trim() === id);
      const dept = String(row?.pkDept ?? '').trim();
      this.deptCache.set(id, { dept, at: Date.now() });
      return dept || undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`lookupPkDept failed: ${message}`);
      return undefined;
    }
  }

  async post<T>(
    path: string,
    body: Record<string, unknown>,
    ctx: RequestContext = {},
  ): Promise<T> {
    const mode = String(body.mode ?? '').trim();
    const tool = tdsMcpToolName(path, mode);
    const args = tdsMcpArguments(path, mode, body);
    const unionId = this.resolveUnionId(ctx);
    this.logger.debug(`MCP ${tool} mode=${mode}`);
    const payload = await this.mcp.callTool(tool, args, unionId);
    return unwrapTdsServePayload<T>(payload, `MCP ${tool}`);
  }
}
