import { extractLeavePolicyTerms } from '../../../legacy/systems/kms/knowledge-query.rewrite';
import { isVagueKnowledgeFollowUp } from './resolve-knowledge-query';

const STOP = new Set([
  '怎么',
  '如何',
  '怎样',
  '什么',
  '哪些',
  '多少',
  '请问',
  '每天',
  '这个',
  '那个',
  '一下',
  '是否',
  '有没有',
  '填写',
  '处理',
  '计算',
  '告诉',
  '说明',
  '具体',
  '操作',
  '指引',
  '问题',
]);

/** 问句里的虚词，切开后再抽实词，避免整句粘成一个块。 */
const PARTICLES = ['的', '地', '得', '了', '吗', '呢', '啊', '呀', '是'];
const PUNCT = ['？', '?', '！', '!', '。', '.', '，', ',', '、'];
/** 上一句里出现过、且足够具体，才认为上文已经覆盖本句。 */
const MIN_CONTEXT_COVER_LEN = 3;
/** 无空格中文整句会粘成一块；超过这个长度改成 2/3 字切片。 */
const MAX_CJK_TOKEN = 4;

function stripQuestionFillers(question: string): string {
  const fillers = [...STOP, ...PARTICLES, ...PUNCT].sort(
    (a, b) => b.length - a.length,
  );
  let text = question.trim();
  for (const filler of fillers) {
    text = text.split(filler).join(' ');
  }
  return text;
}

function cjkContentTokens(run: string): string[] {
  if (run.length <= MAX_CJK_TOKEN) return [run];
  const tokens: string[] = [];
  for (let index = 0; index < run.length - 1; index += 1) {
    tokens.push(run.slice(index, index + 2));
    if (index + 3 <= run.length) tokens.push(run.slice(index, index + 3));
  }
  return tokens;
}

export function questionContentTokens(question: string): string[] {
  const prepared = stripQuestionFillers(question);
  const raw = [
    ...(prepared.match(/[\u4e00-\u9fff]{2,}/g) ?? []),
    ...(prepared.match(/[A-Za-z]{2,}[A-Za-z0-9]*/g) ?? []),
  ];
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const run of raw) {
    const pieces = /^[\u4e00-\u9fff]+$/.test(run)
      ? cjkContentTokens(run)
      : [run];
    for (const token of pieces) {
      if (STOP.has(token) || seen.has(token)) continue;
      seen.add(token);
      tokens.push(token);
    }
  }
  return tokens;
}

export function leaveTermsForCoverage(question: string): string[] {
  return [
    ...new Set(
      extractLeavePolicyTerms(question).filter((term) => term !== '请假'),
    ),
  ];
}

/** 覆盖判断用假种或步骤检索词，不要拿整句里的旅游/行程去对齐制度切片。 */
export function knowledgeCoverageQuery(
  question: string,
  stepQuery?: string,
): string {
  const leave = leaveTermsForCoverage(question).join(' ');
  if (leave) return leave;
  const step = stepQuery?.trim();
  if (step) return step;
  return question.trim();
}

/** 步骤若在查假种，检索词只用假种，避免「申请 天数」把考勤制度顶到前面。 */
export function focusKmsSearchQuery(question: string, stepQuery: string): string {
  const leave = leaveTermsForCoverage(question);
  const step = stepQuery.trim();
  if (!leave.length || !step) return step;
  if (leave.some((term) => step.includes(term))) {
    return leave.join(' ');
  }
  return step;
}

export function uniqueQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of queries) {
    const text = item.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

/** 切片对不齐时换成更短的制度词，不要用同一长 query 再搜一遍。 */
export function nextKnowledgeRetryQuery(
  question: string,
  previousQuery: string,
): string {
  const leave = leaveTermsForCoverage(question).join(' ');
  const prev = previousQuery.trim();
  if (leave && leave !== prev) return leave;
  const first = prev.split(/\s+/).find((part) => part.length >= 2);
  if (first && first !== prev) return first;
  return prev;
}

export function knowledgeResultEvidence(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const rec = result as { chunks?: unknown; answer?: unknown };
  const parts: string[] = [];
  if (Array.isArray(rec.chunks)) {
    for (const chunk of rec.chunks) {
      if (chunk == null) continue;
      parts.push(String(chunk));
    }
  }
  if (typeof rec.answer === 'string') parts.push(rec.answer);
  return parts.join('\n');
}

function textMentionsToken(text: string, token: string): boolean {
  if (!token) return false;
  if (text.includes(token)) return true;
  // 「年假」对「年休假」：只对 2 字词做逐字包含，长词逐字会把旅游/行程误判成制度未覆盖。
  if (token.length !== 2) return false;
  return [...token].every((ch) => text.includes(ch));
}

/** 切片是否覆盖本句要查的事实。短追问只看有没有召回。 */
export function evidenceCoversQuestion(
  question: string,
  result: unknown,
): boolean {
  const evidence = knowledgeResultEvidence(result);
  if (!evidence.trim()) return false;
  if (isVagueKnowledgeFollowUp(question)) return true;
  const leaveTerms = leaveTermsForCoverage(question);
  if (leaveTerms.length) {
    return leaveTerms.every((term) => textMentionsToken(evidence, term));
  }
  const tokens = questionContentTokens(question);
  if (!tokens.length) return true;
  return tokens.some((token) => textMentionsToken(evidence, token));
}

/**
 * 上一句助手回答是否已经写明本句要问的要点。
 * 看实词是否出现在上文，不要靠追问前缀清单叠加。
 */
export function previousReplyCoversQuestion(
  question: string,
  previousReply?: string,
): boolean {
  const reply = previousReply?.trim() ?? '';
  if (!reply) return false;
  const tokens = questionContentTokens(question).filter(
    (token) => token.length >= MIN_CONTEXT_COVER_LEN,
  );
  if (!tokens.length) return false;
  return tokens.every((token) => reply.includes(token));
}
