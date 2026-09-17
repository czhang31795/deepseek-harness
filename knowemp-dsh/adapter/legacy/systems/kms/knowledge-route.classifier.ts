import { Logger } from '../../../nest-shim.ts'
import { LlmService } from '../../../llm/llm.service';
import {
  heuristicIsStandard,
  KNOWLEDGE_ROUTE_PROMPT,
  parseKnowledgeRoute,
  type KnowledgeRoute,
} from './knowledge-route';

export class KnowledgeRouteClassifier {
  private readonly logger = new Logger(KnowledgeRouteClassifier.name);

    private readonly llm: LlmService
  constructor(
    llm: LlmService
  ) {
    this.llm = llm
}

  async classify(query: string, topicHint?: string): Promise<KnowledgeRoute> {
    const hinted = heuristicIsStandard(query);
    if (hinted === true) return 'standard';
    if (hinted === false) return 'other';
    if (!this.llm.isConfigured()) return 'unsure';
    const topic = topicHint?.trim();
    const userContent = topic
      ? `当前话题: ${topic.slice(0, 200)}\n用户问题: ${query.slice(0, 2000)}`
      : query.slice(0, 2000);

    try {
      const result = await this.llm.chat(
        [
          { role: 'system', content: KNOWLEDGE_ROUTE_PROMPT },
          { role: 'user', content: userContent },
        ],
        { temperature: 0, maxTokens: 80, thinking: 'disabled' },
      );
      const parsed = parseKnowledgeRoute(result.content ?? '');
      if (parsed) return parsed;
      this.logger.warn('知识路由模型未返回可用 JSON，改为询问用户');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`知识路由分类失败，改为询问用户：${message}`);
    }
    return 'unsure';
  }
}
