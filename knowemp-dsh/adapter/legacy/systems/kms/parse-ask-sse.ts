export interface AilyAskFinished {
  hasAnswer: boolean;
  finishType?: string;
  answer?: string;
  chunks: string[];
  error?: string;
}

/** 解析 Aily knowledges/ask 的 SSE 或整段 JSON。切片与答案可能分布在不同事件里，需要合并。 */
export function parseAilyAskSse(text: string): AilyAskFinished {
  const payloads = extractJsonPayloads(text);
  if (!payloads.length) {
    return { hasAnswer: false, chunks: [], error: 'Aily 知识问答没有返回内容' };
  }

  let hasAnswer = false;
  let finishType: string | undefined;
  let answer: string | undefined;
  let chunks: string[] = [];
  let faqAnswer: string | undefined;
  let lastStatus: string | undefined;

  for (const rec of payloads) {
    if (typeof rec.code === 'number' && rec.code !== 0) {
      const msg =
        asString(rec.msg) || asString(rec.message) || `Aily 错误 ${rec.code}`;
      return { hasAnswer: false, chunks: [], error: msg };
    }
    lastStatus = asString(rec.status) ?? lastStatus;
    if (rec.has_answer === true) hasAnswer = true;
    finishType = asString(rec.finish_type) ?? finishType;
    const msgContent = asString(
      rec.message && typeof rec.message === 'object'
        ? (rec.message as { content?: unknown }).content
        : rec.content,
    );
    if (msgContent) answer = msgContent;
    const process =
      rec.process_data && typeof rec.process_data === 'object'
        ? (rec.process_data as Record<string, unknown>)
        : null;
    if (process) {
      const nextChunks = asChunkList(process.chunks);
      if (nextChunks.length) chunks = nextChunks;
    }
    const faq =
      rec.faq_result && typeof rec.faq_result === 'object'
        ? (rec.faq_result as Record<string, unknown>)
        : null;
    if (faq) faqAnswer = asString(faq.answer) ?? faqAnswer;
  }

  const finalAnswer = faqAnswer || answer;
  const fallback = isAilyFallbackReply(finalAnswer);
  const realHit =
    chunks.length > 0 ||
    (Boolean(finalAnswer) &&
      !fallback &&
      (hasAnswer || lastStatus === 'finished'));
  if (realHit) {
    return {
      hasAnswer: true,
      finishType,
      answer: finalAnswer,
      chunks,
    };
  }
  if (lastStatus === 'processing' && !fallback) {
    return {
      hasAnswer: false,
      chunks: [],
      error: 'Aily 知识问答未完成',
    };
  }
  return {
    hasAnswer: false,
    finishType,
    chunks: [],
    error: fallback
      ? '知识库没有可检索内容，或问题没有命中切片'
      : '知识库没有命中',
  };
}

export function isAilyFallbackReply(text?: string): boolean {
  const value = (text ?? '').replace(/\s+/g, '');
  if (!value) return false;
  return (
    value.includes('没有明白你的意思') ||
    value.includes('请重新进行对话') ||
    value.includes('我还不清楚你的意思')
  );
}

export function normalizeKnowledgeChunk(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => flattenKnowledgeValue(item))
          .filter(Boolean)
          .join('\n');
      }
      return flattenKnowledgeValue(parsed);
    } catch {
      return text;
    }
  }
  return text;
}

function extractJsonPayloads(text: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const trimmed = text.trim();
  const dataLines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'));
  const rawList = dataLines.length
    ? dataLines.map((line) => line.slice(5).trim())
    : trimmed
      ? [trimmed]
      : [];
  for (const raw of rawList) {
    if (!raw || raw === '[DONE]') continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') continue;
      const rec = parsed as Record<string, unknown>;
      if (rec.data && typeof rec.data === 'object' && !Array.isArray(rec.data)) {
        const data = rec.data as Record<string, unknown>;
        if (typeof rec.code === 'number') data.code = rec.code;
        if (rec.msg != null) data.msg = rec.msg;
        out.push(data);
      } else {
        out.push(rec);
      }
    } catch {
      // skip malformed SSE line
    }
  }
  return out;
}

function asChunkList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeKnowledgeChunk(String(item ?? '')))
    .map((item) => item.trim())
    .filter(Boolean);
}

function flattenKnowledgeValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => flattenKnowledgeValue(item)).filter(Boolean).join('\n');
  }
  if (typeof value !== 'object') return '';

  const rec = value as Record<string, unknown>;
  const label =
    rec.Label && typeof rec.Label === 'object'
      ? asString((rec.Label as { zh_cn?: unknown }).zh_cn)
      : asString(rec.Label);
  const field = label || asString(rec.APIName) || asString(rec.field_name);
  const cell = rec.Value ?? rec.value;
  if (field && cell != null && typeof cell !== 'object') {
    return `${field}：${String(cell)}`;
  }
  if (field && cell != null && typeof cell === 'object') {
    const nested = flattenKnowledgeValue(cell);
    return nested ? `${field}：${nested}` : field;
  }

  const title =
    asString(rec.title) ||
    asString(rec.Title) ||
    asString(rec.source) ||
    asString(rec.name);
  const content =
    asString(rec.content) ||
    asString(rec.text) ||
    asString(rec.snippet) ||
    asString(rec.chunk) ||
    (rec.content && typeof rec.content === 'object'
      ? flattenKnowledgeValue(rec.content)
      : undefined);
  if (title && content) return `${title}\n${content}`;
  if (content) return content;
  if (title) return title;

  const skip = new Set(['APIID', 'APIName', 'Desc', 'Label', 'id', 'ID']);
  return Object.entries(rec)
    .filter(([key]) => !skip.has(key))
    .map(([, item]) => flattenKnowledgeValue(item))
    .filter(Boolean)
    .join('\n');
}

function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}
