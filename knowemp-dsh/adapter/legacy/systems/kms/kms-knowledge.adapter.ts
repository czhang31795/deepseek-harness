import type {
  KnowledgeSearchQuery,
  KnowledgeSearchResult,
} from '../../../domain/knowledge';
import { KNOWLEDGE_SOURCE_SYSTEM } from '../../../domain/knowledge';
import type { KnowledgePort } from '../../contracts/knowledge.port';
import { AilyKnowledgeClient } from './aily-knowledge.client';

export class KmsKnowledgeAdapter implements KnowledgePort {
  readonly systemId = KNOWLEDGE_SOURCE_SYSTEM;

    private readonly aily: AilyKnowledgeClient
  constructor(
    aily: AilyKnowledgeClient
  ) {
    this.aily = aily
}

  search(query: KnowledgeSearchQuery): Promise<KnowledgeSearchResult> {
    return this.aily.ask(query.query, {
      isStandard: query.isStandard,
      topicHint: query.skipRewrite ? undefined : query.topicHint,
      skipRewrite: query.skipRewrite,
    });
  }
}
