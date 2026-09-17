/** 指示代词开头的短句。不要往这里加词；上文已覆盖的追问走 previousReplyCoversQuestion。 */
const VAGUE_FOLLOW_UP_PREFIXES = [
  '还有',
  '然后',
  '另外',
  '再问',
  '再查',
  '怎么',
  '如何',
  '平时',
  '那',
  '再',
];

export function isVagueKnowledgeFollowUp(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 24) return false;
  return VAGUE_FOLLOW_UP_PREFIXES.some((prefix) => text.startsWith(prefix));
}

/** 只有短追问才把上一轮检索词带去改写，完整新问题按本句检索。 */
export function topicHintForTurn(
  message: string,
  topicHint?: string,
): string | undefined {
  const topic = topicHint?.trim();
  if (!topic) return undefined;
  if (!isVagueKnowledgeFollowUp(message)) return undefined;
  return topic;
}

function distinctiveCodes(text: string): string[] {
  return text.match(/[A-Za-z]{2,}[A-Za-z0-9]*|\d+/g) ?? [];
}

/**
 * 工具参数优先；短追问不要覆盖模型改写好的检索词。
 * 用户原句里的型号数字若被模型丢掉，则改回原句。
 */
export function resolveKnowledgeSearchQuery(
  toolQuery: string,
  userMessage: string,
): string {
  const tool = toolQuery.trim();
  const user = userMessage.trim();
  if (!user) return tool;
  if (!tool) return user;
  if (isVagueKnowledgeFollowUp(user)) return tool;
  const missing = distinctiveCodes(user).filter((token) => !tool.includes(token));
  if (missing.length) return user;
  return tool;
}
