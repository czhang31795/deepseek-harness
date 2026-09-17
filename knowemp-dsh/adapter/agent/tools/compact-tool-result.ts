import { compactMaterialChartForLlm } from '../../legacy/systems/tds/material.mapper';
import { KNOWLEDGE_QA_COMPACT_HINT } from '../prompts/knowledge.prompt';

const KNOWLEDGE_CHUNK_LIMIT = 12;
const KNOWLEDGE_CHUNK_CHARS = 6000;

/** 发给模型的工具结果可以比前端卡片更瘦，避免谱图点把上下文撑爆。 */
export function compactToolResultForLlm(
  name: string,
  result: unknown,
): unknown {
  if (name === 'analyze_material_file_chart') {
    return compactMaterialChartForLlm(result);
  }
  if (name === 'search_knowledge') {
    return compactKnowledgeForLlm(result);
  }
  return result;
}

function flattenChunkForLlm(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item == null) return '';
  if (typeof item === 'number' || typeof item === 'boolean') return String(item);
  try {
    const rec = item as Record<string, unknown>;
    const sourceValue =
      rec.sourceValue && typeof rec.sourceValue === 'object'
        ? (rec.sourceValue as Record<string, unknown>)
        : undefined;
    const meta =
      sourceValue?.meta && typeof sourceValue.meta === 'object'
        ? (sourceValue.meta as Record<string, unknown>)
        : rec.meta && typeof rec.meta === 'object'
          ? (rec.meta as Record<string, unknown>)
          : undefined;
    const title = String(meta?.title ?? rec.title ?? '').trim();
    const content = String(sourceValue?.content ?? rec.content ?? rec.text ?? '').trim();
    const link = String(meta?.link ?? rec.link ?? '').trim();
    const parts = [title, content, link ? `来源：${link}` : ''].filter(Boolean);
    if (parts.length) return parts.join('\n');
  } catch {
    // fall through
  }
  return JSON.stringify(item);
}

function compactKnowledgeForLlm(result: unknown): unknown {
  if (!result || typeof result !== 'object') return result;
  const rec = result as Record<string, unknown>;
  const raw = Array.isArray(rec.chunks) ? rec.chunks : [];
  const chunks = raw.slice(0, KNOWLEDGE_CHUNK_LIMIT).map((item, index) => {
    const text = stripRetrieveMeta(flattenChunkForLlm(item));
    const clipped =
      text.length > KNOWLEDGE_CHUNK_CHARS
        ? `${text.slice(0, KNOWLEDGE_CHUNK_CHARS)}…`
        : text;
    return `【切片${index + 1}】\n${clipped}`;
  });
  return {
    resource: rec.resource,
    source: rec.source,
    configured: rec.configured,
    hasAnswer: rec.hasAnswer,
    query: rec.query,
    queries: rec.queries,
    stepHits: rec.stepHits,
    isStandard: rec.isStandard,
    searchedBoth: rec.searchedBoth,
    chunkCount: raw.length,
    instruction: KNOWLEDGE_QA_COMPACT_HINT,
    chunks,
    error: rec.error,
    message: rec.message,
  };
}

function stripRetrieveMeta(text: string): string {
  return text
    .split('\n')
    .filter(
      (line) =>
        !line.startsWith('检索词：') && !line.startsWith('召回分数：'),
    )
    .join('\n')
    .trim();
}
