import { Logger, ConfigService } from '../../../nest-shim.ts'
import type { KnowledgeSearchResult } from '../../../domain/knowledge';
import { FeishuTokenService } from './feishu-token.service';
import { KnowledgeQueryRewriter } from './knowledge-query.rewriter';
import { ailySkillStartBody } from './knowledge-route';
import { mergeKnowledgeBranchResults } from './merge-knowledge-results';
import { parseAilyAskSse } from './parse-ask-sse';
import { parseSkillStartResponse } from './parse-skill-output';
import {
  ailyImageDownloadUrl,
  parseAilyFileId,
  rewriteAilyFileTokens,
} from './rewrite-aily-file-urls';

export class AilyKnowledgeClient {
  private readonly logger = new Logger(AilyKnowledgeClient.name);

    private readonly config: ConfigService
  private readonly tokens: FeishuTokenService
  private readonly rewriter: KnowledgeQueryRewriter
  constructor(
    config: ConfigService,
    tokens: FeishuTokenService,
    rewriter: KnowledgeQueryRewriter
  ) {
    this.config = config
    this.tokens = tokens
    this.rewriter = rewriter
}

  get configured(): boolean {
    return this.tokens.configured && Boolean(this.appId);
  }

  async ask(
    query: string,
    options: { isStandard?: boolean; topicHint?: string; skipRewrite?: boolean } = {},
  ): Promise<KnowledgeSearchResult> {
    const q = query.trim();
    if (!q) {
      return emptyResult('missing_query', '请提供要检索的问题。');
    }
    if (!this.tokens.configured || !this.appId) {
      return emptyResult(
        'not_configured',
        '未配置飞书 Aily：需要 FEISHU_APP_ID、FEISHU_APP_SECRET、AILY_APP_ID。AILY_APP_ID 在 Aily 应用 URL 的 /ai/{APPID}。',
      );
    }
    if (this.skillId) {
      const userSpecified = typeof options.isStandard === 'boolean';
      const searchQuery = await this.rewriter.rewrite(
        q,
        options.skipRewrite ? undefined : options.topicHint,
        options.skipRewrite === true,
      );
      if (userSpecified) {
        this.logger.log(`KMS 路由 is_standard=${options.isStandard}（用户指定）`);
        const result = await this.startSkill(
          searchQuery,
          options.isStandard as boolean,
        );
        this.logRecall(searchQuery, options.isStandard as boolean, result);
        if (!options.isStandard && !result.chunks.length) {
          this.logger.warn(
            'KMS 其它库召回为空。请检查飞书工作流 is_standard=false 分支是否勾了制度规范库、生产知识库等，以及结束节点 chunks 是否绑到该分支的检索结果。',
          );
        }
        return { ...result, isStandard: options.isStandard, query: searchQuery };
      }

      this.logger.log('KMS 双路检索 is_standard=true|false');
      const [standard, other] = await Promise.all([
        this.startSkill(searchQuery, true),
        this.startSkill(searchQuery, false),
      ]);
      this.logRecall(searchQuery, true, standard);
      this.logRecall(searchQuery, false, other);
      if (!standard.chunks.length && !other.chunks.length) {
        this.logger.warn(
          'KMS 两路召回均为空。请检查飞书工作流 is_standard 两路是否勾了对应知识空间，以及结束节点 chunks 是否绑到分支检索结果。',
        );
      }
      return mergeKnowledgeBranchResults(
        searchQuery,
        standard,
        other,
        Math.min(this.maxChunks * 2, 16),
      );
    }

    const token = await this.tokens.getTenantAccessToken();
    const url = `${this.openBase}/open-apis/aily/v1/apps/${encodeURIComponent(this.appId)}/knowledges/ask`;
    const body: Record<string, unknown> = {
      message: { content: q.slice(0, 65535) },
    };
    if (this.dataAssetIds.length) {
      body.data_asset_ids = this.dataAssetIds;
    }
    if (this.dataAssetTagIds.length) {
      body.data_asset_tag_ids = this.dataAssetTagIds;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
          Accept: 'text/event-stream, application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        this.logger.warn(`Aily ask HTTP ${res.status}`);
        return emptyResult('ask_failed', httpErrorMessage(res.status, text));
      }
      return this.rewriteSearchResult(toSearchResult(parseAilyAskSse(text)));
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      const message = aborted
        ? 'Aily 知识问答超时'
        : error instanceof Error
          ? error.message
          : String(error);
      this.logger.warn(message);
      return emptyResult('ask_failed', message);
    } finally {
      clearTimeout(timer);
    }
  }

  private async startSkill(
    query: string,
    isStandard: boolean,
  ): Promise<KnowledgeSearchResult> {
    const token = await this.tokens.getTenantAccessToken();
    const url = new URL(
      `${this.openBase}/open-apis/aily/v1/apps/${encodeURIComponent(this.appId)}/skills/${encodeURIComponent(this.skillId)}/start`,
    );
    if (this.tenantType) {
      url.searchParams.set('tenant_type', this.tenantType);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(ailySkillStartBody(query, isStandard)),
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        this.logger.warn(`Aily skill HTTP ${res.status}`);
        return emptyResult('ask_failed', httpErrorMessage(res.status, text));
      }
      return this.rewriteSearchResult(
        toSearchResult(parseSkillStartResponse(text, { maxChunks: this.maxChunks })),
      );
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      const message = aborted
        ? 'Aily 知识问答超时'
        : error instanceof Error
          ? error.message
          : String(error);
      this.logger.warn(message);
      return emptyResult('ask_failed', message);
    } finally {
      clearTimeout(timer);
    }
  }

  rewriteFileTokens(text: string): string {
    return rewriteAilyFileTokens(text, this.appId, this.fileBaseUrl);
  }

  rewriteToolResult(result: unknown): unknown {
    if (!result || typeof result !== 'object') return result;
    const rec = result as KnowledgeSearchResult;
    if (rec.resource !== 'knowledge') return result;
    return this.rewriteSearchResult(rec);
  }

  async downloadImage(
    fileId: string,
  ): Promise<{ body: Buffer; contentType: string } | undefined> {
    const id = parseAilyFileId(fileId);
    if (!id || !this.appId || !this.fileBaseUrl) return undefined;
    if (!this.tokens.configured) return undefined;
    const url = ailyImageDownloadUrl(id, this.appId, this.fileBaseUrl);
    const token = await this.tokens.getTenantAccessToken();
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'image/*,*/*',
        Referer: `${this.fileBaseUrl}/`,
      },
    });
    const contentType = res.headers.get('content-type') ?? '';
    if (!res.ok || contentType.includes('text/html')) {
      this.logger.warn(`Aily image HTTP ${res.status} ct=${contentType || 'empty'}`);
      return undefined;
    }
    return {
      body: Buffer.from(await res.arrayBuffer()),
      contentType: contentType || 'application/octet-stream',
    };
  }

  private logRecall(
    query: string,
    isStandard: boolean,
    result: KnowledgeSearchResult,
  ) {
    const titles = result.chunks
      .map((chunk) =>
        String(chunk)
          .split('\n')
          .map((line) => line.trim())
          .find(Boolean) ?? '',
      )
      .filter(Boolean)
      .slice(0, 5);
    const preview = String(result.chunks[0] ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    const titleText = titles.join(' | ') || 'none';
    this.logger.log(
      [
        `KMS 召回 is_standard=${isStandard}`,
        `query=${query.slice(0, 80)}`,
        `count=${result.chunks.length}/${result.recalledCount ?? result.chunks.length}`,
        `hasAnswer=${result.hasAnswer}`,
        `titles=${titleText}`,
        `preview=${preview || 'none'}`,
      ].join(' '),
    );
  }

  private rewriteSearchResult(
    result: KnowledgeSearchResult,
  ): KnowledgeSearchResult {
    return {
      ...result,
      chunks: result.chunks.map((chunk) => this.rewriteFileTokens(chunk)),
      answer: result.answer ? this.rewriteFileTokens(result.answer) : result.answer,
      message: result.message
        ? this.rewriteFileTokens(result.message)
        : result.message,
    };
  }

  private get appId(): string {
    return (this.config.get<string>('AILY_APP_ID') ?? '').trim();
  }

  private get fileBaseUrl(): string {
    return (this.config.get<string>('AILY_FILE_BASE_URL') ?? '')
      .trim()
      .replace(/\/$/, '');
  }

  private get skillId(): string {
    return (this.config.get<string>('AILY_SKILL_ID') ?? '').trim();
  }

  private get tenantType(): string {
    return (this.config.get<string>('AILY_TENANT_TYPE') ?? '').trim();
  }

  private get dataAssetIds(): string[] {
    return splitIds(this.config.get<string>('AILY_DATA_ASSET_IDS'));
  }

  private get dataAssetTagIds(): string[] {
    return splitIds(this.config.get<string>('AILY_DATA_ASSET_TAG_IDS'));
  }

  private get openBase(): string {
    return (
      this.config.get<string>('FEISHU_OPEN_BASE_URL') ?? 'https://open.feishu.cn'
    ).replace(/\/$/, '');
  }

  private get timeoutMs(): number {
    const fallback = this.skillId ? '120000' : '60000';
    const n = Number.parseInt(
      this.config.get<string>('AILY_ASK_TIMEOUT_MS') ?? fallback,
      10,
    );
    return Number.isFinite(n) && n > 0 ? n : this.skillId ? 120_000 : 60_000;
  }

  private get maxChunks(): number {
    const n = Number.parseInt(
      this.config.get<string>('KNOWLEDGE_MAX_CHUNKS') ?? '10',
      10,
    );
    return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 1;
  }
}

function splitIds(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function httpErrorMessage(status: number, body: string): string {
  const prefix = `Aily 知识问答 HTTP ${status}`;
  try {
    const json = JSON.parse(body) as { msg?: unknown; message?: unknown };
    const detail = String(json.msg ?? json.message ?? '').trim();
    return detail ? `${prefix}: ${detail.slice(0, 200)}` : prefix;
  } catch {
    return prefix;
  }
}

function emptyResult(
  error: string,
  message: string,
): KnowledgeSearchResult {
  return {
    resource: 'knowledge',
    source: 'kms',
    configured: error !== 'not_configured',
    hasAnswer: false,
    chunks: [],
    recalledCount: 0,
    error,
    message,
  };
}

function toSearchResult(parsed: {
  hasAnswer: boolean;
  answer?: string;
  chunks: string[];
  recalledCount?: number;
  error?: string;
}): KnowledgeSearchResult {
  if (parsed.error && !parsed.hasAnswer && !parsed.chunks.length) {
    const noHit = parsed.error === '知识库没有命中';
    return emptyResult(noHit ? 'no_hit' : 'ask_failed', parsed.error);
  }
  return {
    resource: 'knowledge',
    source: 'kms',
    configured: true,
    hasAnswer: parsed.hasAnswer,
    chunks: parsed.chunks,
    recalledCount: parsed.recalledCount ?? parsed.chunks.length,
    message: parsed.hasAnswer ? undefined : '知识库没有命中相关内容。',
  };
}
