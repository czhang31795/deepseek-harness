export const KNOWLEDGE_QUERY_REWRITE_PROMPT = `你把用户本句改写成企业知识库检索词。

要求：
- 只根据用户本句改写，不要引入本句没有的主题
- 若提供了当前话题，仅当本句是短追问时带上话题，用来补全指代
- 保留产品型号、项目名、标准号、数字、工龄，以及原句里的休假名称
- 口语改成制度、内部技术要求或标准文本里会出现的词
- 本句同时有休假/制度和行程规划时，检索词只留制度与假种，不要写旅游、行程、地点
- 年假改成「年休假」
- 只输出一行检索词，不要解释`;

function isCjk(ch: string): boolean {
  return ch >= '\u4e00' && ch <= '\u9fff';
}

/**
 * 从原句抽出「…假」，只给改写结果做漏词补回，不负责整句改写。
 */
export function extractLeavePolicyTerms(query: string): string[] {
  const text = query.trim();
  const terms: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '假') continue;
    let start = index;
    let taken = 0;
    while (start > 0 && taken < 3 && isCjk(text[start - 1])) {
      start -= 1;
      taken += 1;
    }
    let term = text.slice(start, index + 1);
    if (term.includes('度假')) continue;
    while (term.length > 2 && (term.startsWith('请') || term.startsWith('要'))) {
      term = term.slice(1);
    }
    if (term.length < 2 || seen.has(term)) continue;
    seen.add(term);
    terms.push(term);
  }
  return terms;
}

function normalizeLeaveTerm(term: string): string {
  if (term === '年假' || term === '年休假') return '年休假';
  return term;
}

/** 检索词已经是假种本身时不要再扩成「申请 天数 条件」。 */
export function isLeaveOnlyQuery(query: string): boolean {
  const text = query.trim();
  const leave = extractLeavePolicyTerms(text).filter((term) => term !== '请假');
  if (!leave.length) return false;
  const compact = text.replace(/\s+/g, '');
  return compact === leave.join('');
}

/** 模型改写若丢掉原句里的假种，补回词，不替代整句改写。 */
export function keepDroppedLeaveTerms(
  rewritten: string,
  original: string,
): string {
  const text = rewritten.trim();
  if (!text) return original.trim();
  const terms = [
    ...new Set(extractLeavePolicyTerms(original).map(normalizeLeaveTerm)),
  ].filter((term) => term !== '请假');
  const missing = terms.filter(
    (term) => !text.includes(term) && !text.includes(term.replace('年休假', '年假')),
  );
  if (!missing.length) return text;
  return `${missing.join(' ')} ${text}`.trim();
}

export function parseRewrittenKnowledgeQuery(
  raw: string,
  original: string,
): string {
  const fallback = original.trim();
  const line = raw
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/```[a-z]*\s*/gi, '').replace(/```/g, ''),
    )
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean);
  if (!line) return fallback;
  const cleaned = line
    .replace(/^["「『]+/, '')
    .replace(/["」』]+$/, '')
    .replace(/^检索词[:：]\s*/, '')
    .trim();
  if (!cleaned || cleaned.length > 240) return fallback;
  return cleaned;
}
