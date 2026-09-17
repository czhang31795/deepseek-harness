import {
  KNOWLEDGE_RESOURCE,
  KNOWLEDGE_SOURCE_SYSTEM,
  type KnowledgeSearchResult,
} from '../../../domain/knowledge';

const LIBRARY_TAG_RE = /^【(标准库|其他库)】/;

export function tagKnowledgeChunk(
  chunk: string,
  library: 'standard' | 'other',
): string {
  const text = chunk.trim();
  if (!text) return text;
  if (LIBRARY_TAG_RE.test(text)) return text;
  const label = library === 'standard' ? '标准库' : '其他库';
  return `【${label}】${text}`;
}

export function mergeKnowledgeBranchResults(
  query: string,
  standard: KnowledgeSearchResult,
  other: KnowledgeSearchResult,
  maxChunks = 16,
): KnowledgeSearchResult {
  const standardChunks = standard.chunks
    .map((chunk) => tagKnowledgeChunk(chunk, 'standard'))
    .filter(Boolean);
  const otherChunks = other.chunks
    .map((chunk) => tagKnowledgeChunk(chunk, 'other'))
    .filter(Boolean);
  const chunks = dedupeChunks([...standardChunks, ...otherChunks]).slice(
    0,
    Math.max(1, maxChunks),
  );
  const standardHit = standard.chunks.length > 0;
  const otherHit = other.chunks.length > 0;
  const configured = standard.configured || other.configured;
  const error = chunks.length
    ? undefined
    : [standard.error, other.error].filter(Boolean).join('；') ||
      standard.message ||
      other.message ||
      undefined;

  return {
    resource: KNOWLEDGE_RESOURCE,
    source: KNOWLEDGE_SOURCE_SYSTEM,
    configured,
    hasAnswer: chunks.length > 0,
    query,
    recalledCount:
      (standard.recalledCount ?? standard.chunks.length) +
      (other.recalledCount ?? other.chunks.length),
    isStandard: standardHit === otherHit ? undefined : standardHit,
    searchedBoth: true,
    chunks,
    error: chunks.length ? undefined : error || 'no_hit',
    message: chunks.length
      ? undefined
      : '知识库没有命中相关内容。',
  };
}

function dedupeChunks(chunks: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const chunk of chunks) {
    const key = chunk.replace(LIBRARY_TAG_RE, '').slice(0, 160);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(chunk);
  }
  return unique;
}

export function mergeKnowledgeSearchResults(
  parts: Array<{ query: string; result: KnowledgeSearchResult }>,
  maxChunks = 16,
): KnowledgeSearchResult {
  if (parts.length === 1) {
    return {
      ...parts[0].result,
      query: parts[0].result.query || parts[0].query,
    };
  }
  const chunks = dedupeChunks(
    parts.flatMap((part) =>
      part.result.chunks.map((chunk) => String(chunk).trim()).filter(Boolean),
    ),
  ).slice(0, Math.max(1, maxChunks));
  const recalledCount = parts.reduce(
    (sum, part) =>
      sum + (part.result.recalledCount ?? part.result.chunks.length),
    0,
  );
  const configured = parts.some((part) => part.result.configured);
  const queries = parts.map(
    (part) => String(part.result.query || part.query).trim() || part.query,
  );
  const stepHits = parts.map((part) => ({
    query: String(part.result.query || part.query).trim() || part.query,
    hasAnswer: part.result.hasAnswer === true && part.result.chunks.length > 0,
    recalledCount: part.result.recalledCount ?? part.result.chunks.length,
  }));
  const error = chunks.length
    ? undefined
    : parts.map((part) => part.result.error).filter(Boolean).join('；') ||
      'no_hit';
  return {
    resource: KNOWLEDGE_RESOURCE,
    source: KNOWLEDGE_SOURCE_SYSTEM,
    configured,
    hasAnswer: chunks.length > 0,
    query: queries.join(' | '),
    queries,
    recalledCount,
    searchedBoth: parts.some((part) => part.result.searchedBoth),
    chunks,
    error: chunks.length ? undefined : error,
    message: chunks.length ? undefined : '知识库没有命中相关内容。',
    stepHits,
  };
}
