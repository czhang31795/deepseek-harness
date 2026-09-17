import type {
  KnowledgeSearchQuery,
  KnowledgeSearchResult,
} from '../../domain/knowledge';

export interface KnowledgePort {
  readonly systemId: string;
  search(query: KnowledgeSearchQuery): Promise<KnowledgeSearchResult>;
}

export const KNOWLEDGE_PORTS = Symbol('KNOWLEDGE_PORTS');
