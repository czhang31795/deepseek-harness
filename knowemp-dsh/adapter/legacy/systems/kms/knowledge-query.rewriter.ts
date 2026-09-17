import { Logger } from '../../../nest-shim.ts'
import { LlmService } from '../../../llm/llm.service';
import {
  KNOWLEDGE_QUERY_REWRITE_PROMPT,
  isLeaveOnlyQuery,
  keepDroppedLeaveTerms,
  parseRewrittenKnowledgeQuery,
} from './knowledge-query.rewrite';

export class KnowledgeQueryRewriter {
  private readonly logger = new Logger(KnowledgeQueryRewriter.name);

    private readonly llm: LlmService
  constructor(
    llm: LlmService
  ) {
    this.llm = llm
}

  async rewrite(
    query: string,
    topicHint?: string,
    skipLlm = false,
  ): Promise<string> {
    const original = query.trim();
    if (!original) return original;
    if (skipLlm || !this.llm.isConfigured() || isLeaveOnlyQuery(original)) {
      return original;
    }
    const topic = topicHint?.trim();
    const userContent = topic
      ? `当前话题: ${topic.slice(0, 200)}\n用户本句: ${original.slice(0, 2000)}`
      : original.slice(0, 2000);

    try {
      const result = await this.llm.chat(
        [
          { role: 'system', content: KNOWLEDGE_QUERY_REWRITE_PROMPT },
          { role: 'user', content: userContent },
        ],
        { temperature: 0, maxTokens: 80, thinking: 'disabled' },
      );
      const rewritten = keepDroppedLeaveTerms(
        parseRewrittenKnowledgeQuery(result.content ?? '', original),
        original,
      );
      if (rewritten !== original) {
        this.logger.log(`KMS 检索词改写 ${original} → ${rewritten}`);
      }
      return rewritten;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`KMS 检索词改写失败，改用原句：${message}`);
      return original;
    }
  }
}
