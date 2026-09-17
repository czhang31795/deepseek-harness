import type { LlmMessage } from './llm.service';

/**
 * Qwen / vLLM chat template 只允许第一条是 system：
 * 会先吃掉 messages[0]，后面再出现 system 就报
 * “System message must be at the beginning.”
 */
export function collapseSystemMessagesForQwen(
  messages: LlmMessage[],
): LlmMessage[] {
  const leading: string[] = [];
  const rest: LlmMessage[] = [];
  let seenNonSystem = false;

  for (const message of messages) {
    if (message.role === 'system') {
      const text = message.content?.trim();
      if (!text) continue;
      if (!seenNonSystem) {
        leading.push(text);
        continue;
      }
      rest.push({
        role: 'user',
        content: `系统补充：\n${text}`,
      });
      continue;
    }
    seenNonSystem = true;
    rest.push(message);
  }

  if (!leading.length) return rest;
  return [{ role: 'system', content: leading.join('\n\n') }, ...rest];
}
