import type { RequestContext } from '../common/types/request-context';

export const KNOWLEDGE_RESOURCE = 'knowledge';
export const KNOWLEDGE_SOURCE_SYSTEM = 'kms';

export interface KnowledgeSearchQuery {
  query: string;
  /** 用户点选或明确路由后跳过模型分类。 */
  isStandard?: boolean;
  /** 上一轮知识检索话题，仅由 agent 注入，不进工具 schema。 */
  topicHint?: string;
  /** 重试时跳过改写，直接用本句检索。 */
  skipRewrite?: boolean;
  ctx?: RequestContext;
}

export interface KnowledgeSearchResult {
  resource: 'knowledge';
  source: 'kms';
  configured: boolean;
  hasAnswer: boolean;
  answer?: string;
  query?: string;
  recalledCount?: number;
  isStandard?: boolean;
  /** 未点选库别时两路都检索。 */
  searchedBoth?: boolean;
  chunks: string[];
  error?: string;
  message?: string;
  /** 多步并行检索时的各步检索词。 */
  queries?: string[];
  stepHits?: Array<{ query: string; hasAnswer: boolean; recalledCount: number }>;
}
