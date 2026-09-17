import { isAilyFallbackReply } from './parse-ask-sse';

export const DEFAULT_KNOWLEDGE_MAX_CHUNKS = 10;

export interface ParseSkillOptions {
  maxChunks?: number;
}

export interface AilySkillFinished {
  hasAnswer: boolean;
  chunks: string[];
  recalledCount?: number;
  error?: string;
}

interface ChunkItem {
  text: string;
  score?: number;
  index: number;
}

/** 按召回分数保留前 N 条。飞书分数经常都接近 0.999，并列时保持原顺序。 */
export function selectTopKnowledgeChunks(
  items: ChunkItem[],
  maxChunks = DEFAULT_KNOWLEDGE_MAX_CHUNKS,
): ChunkItem[] {
  const limit = Number.isFinite(maxChunks)
    ? Math.min(Math.max(Math.trunc(maxChunks), 1), 20)
    : DEFAULT_KNOWLEDGE_MAX_CHUNKS;
  if (items.length <= limit) return items;
  const ranked = items
    .map((item, index) => ({
      ...item,
      index: item.index ?? index,
      rank: item.score ?? Number.NEGATIVE_INFINITY,
    }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index);
  return ranked.slice(0, limit).sort((a, b) => a.index - b.index);
}

/** 解析 Aily skills/:id/start 的 JSON。结束节点出参在 data.output 里，通常是 JSON 字符串。 */
export function parseSkillStartResponse(
  body: string,
  options: ParseSkillOptions = {},
): AilySkillFinished {
  const maxChunks = options.maxChunks ?? DEFAULT_KNOWLEDGE_MAX_CHUNKS;
  const trimmed = body.trim();
  if (!trimmed) {
    return { hasAnswer: false, chunks: [], recalledCount: 0, error: 'Aily 技能没有返回内容' };
  }
  if (trimmed.startsWith('<')) {
    return {
      hasAnswer: false,
      chunks: [],
      recalledCount: 0,
      error: 'Aily 技能调用超时或网关返回了非 JSON',
    };
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return { hasAnswer: false, chunks: [], recalledCount: 0, error: 'Aily 技能返回无法解析' };
  }

  const code = typeof json.code === 'number' ? json.code : 0;
  if (code !== 0) {
    const msg = String(json.msg ?? json.message ?? `Aily 技能错误 ${code}`).trim();
    return { hasAnswer: false, chunks: [], recalledCount: 0, error: msg.slice(0, 300) };
  }

  const data =
    json.data && typeof json.data === 'object' && !Array.isArray(json.data)
      ? (json.data as Record<string, unknown>)
      : {};
  const status = String(data.status ?? '').trim();
  const output = parseOutput(data.output);
  const collected = collectChunkItems(output);
  const leftoverAnswer = firstString(output, [
    'answer',
    'result',
    'content',
    'message',
  ]);

  if (status && status !== 'success' && !collected.length && !leftoverAnswer) {
    return {
      hasAnswer: false,
      chunks: [],
      recalledCount: 0,
      error: `Aily 技能执行失败：${status}`,
    };
  }

  if (collected.length) {
    const kept = selectTopKnowledgeChunks(collected, maxChunks);
    return {
      hasAnswer: true,
      chunks: kept.map((item) => item.text),
      recalledCount: collected.length,
    };
  }

  // 旧「知识空间问答」工作流只出 answer：当成一条切片交给本地模型，避免空召回。
  if (leftoverAnswer && !isAilyFallbackReply(leftoverAnswer)) {
    return { hasAnswer: true, chunks: [leftoverAnswer], recalledCount: 1 };
  }

  return {
    hasAnswer: false,
    chunks: [],
    recalledCount: 0,
    error: leftoverAnswer && isAilyFallbackReply(leftoverAnswer)
      ? '知识库没有可检索内容，或问题没有命中切片'
      : '知识库没有命中',
  };
}

function parseOutput(raw: unknown): Record<string, unknown> {
  if (Array.isArray(raw)) {
    return { chunks: raw };
  }
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return {};
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) return { chunks: parsed };
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
      return { answer: text };
    } catch {
      return { answer: text };
    }
  }
  if (raw && typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }
  return {};
}

function collectChunkItems(output: Record<string, unknown>): ChunkItem[] {
  const fromRoot = chunksFromRecord(output);
  if (fromRoot.length) return fromRoot;
  if (looksLikeRetrieveChunk(output)) {
    const item = toChunkItem(output, 0);
    return item ? [item] : [];
  }
  const nested = output.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return chunksFromRecord(nested as Record<string, unknown>);
  }
  return [];
}

function chunksFromRecord(rec: Record<string, unknown>): ChunkItem[] {
  return chunksFromRecordKeys(rec);
}

function asChunkItems(raw: unknown): ChunkItem[] {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return [];
    const parsed = tryParseJson(text);
    if (parsed !== undefined) return asChunkItems(parsed);
    return [{ text, index: 0 }];
  }
  if (Array.isArray(raw)) {
    const items: ChunkItem[] = [];
    raw.forEach((item, index) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const rec = item as Record<string, unknown>;
        if (looksLikeRetrieveChunk(rec)) {
          const one = toChunkItem(rec, index);
          if (one) items.push(one);
          return;
        }
        const nested = chunksFromRecordKeys(rec);
        if (nested.length) {
          nested.forEach((entry) => items.push({ ...entry, index: items.length }));
          return;
        }
      }
      const text = chunkToText(item).trim();
      if (text) items.push({ text, score: scoreOf(item), index });
    });
    return items;
  }
  if (typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    if (looksLikeRetrieveChunk(rec)) {
      const one = toChunkItem(rec, 0);
      return one ? [one] : [];
    }
    const nested = chunksFromRecordKeys(rec);
    if (nested.length) return nested;
    const one = toChunkItem(rec, 0);
    return one ? [one] : [];
  }
  return [];
}

function chunksFromRecordKeys(rec: Record<string, unknown>): ChunkItem[] {
  for (const key of [
    'chunks',
    'documents',
    'docs',
    'items',
    'records',
    'list',
    'results',
    'result',
  ]) {
    if (rec[key] === undefined) continue;
    const list = asChunkItems(rec[key]);
    if (list.length) return list;
  }
  return [];
}

function toChunkItem(item: unknown, index: number): ChunkItem | undefined {
  const text = chunkToText(item).trim();
  if (!text) return undefined;
  return { text, score: scoreOf(item), index };
}

function scoreOf(item: unknown): number | undefined {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
  return firstNumber(item as Record<string, unknown>, ['recallScore', 'score']);
}

function chunkToText(item: unknown): string {
  if (item == null) return '';
  if (typeof item === 'string') {
    const text = item.trim();
    if (!text) return '';
    const parsed = tryParseJson(text);
    if (parsed !== undefined && parsed !== text) return chunkToText(parsed);
    return text;
  }
  if (typeof item === 'number' || typeof item === 'boolean') {
    return String(item);
  }
  if (Array.isArray(item)) {
    return item.map(chunkToText).map((part) => part.trim()).filter(Boolean).join('\n');
  }
  if (typeof item !== 'object') return '';
  const rec = item as Record<string, unknown>;
  const sourceValue = asRecord(rec.sourceValue) ?? asRecord(tryParseJson(rec.sourceValue));
  const meta =
    asRecord(sourceValue?.meta) ??
    asRecord(tryParseJson(sourceValue?.meta)) ??
    asRecord(rec.meta);
  const content =
    firstString(sourceValue, ['content', 'text', 'snippet', 'chunk']) ||
    firstString(rec, [
      'content',
      'text',
      'snippet',
      'chunk',
      'page_content',
      'pageContent',
    ]);
  const title =
    firstString(meta, ['title', 'name']) ||
    firstString(rec, ['title', 'name', 'source', 'doc_name', 'docName']);
  const link =
    firstString(meta, ['link', 'url']) || firstString(rec, ['link', 'url']);
  const parts: string[] = [];
  if (title) parts.push(title);
  if (content) parts.push(content);
  if (link) parts.push(`来源：${link}`);
  return parts.join('\n');
}

function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text.startsWith('{') && !text.startsWith('[')) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function looksLikeRetrieveChunk(rec: Record<string, unknown>): boolean {
  return (
    rec.sourceValue != null ||
    rec.sourceType != null ||
    rec.knowledgeID != null ||
    rec.knowledgeSpaceID != null
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function firstString(
  rec: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!rec) return undefined;
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function firstNumber(
  rec: Record<string, unknown> | undefined,
  keys: string[],
): number | undefined {
  if (!rec) return undefined;
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}
