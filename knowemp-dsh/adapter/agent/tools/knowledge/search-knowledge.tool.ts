import type { RequestContext } from '../../../common/types/request-context';
import { LegacyFacade } from '../../../legacy/legacy.facade';
import { SEARCH_KNOWLEDGE_CONTRACT } from '../specs/knowledge/search-knowledge.contract';
import type { AgentTool } from '../tool.types';
import { toolFromContract } from '../tool.types';

export class SearchKnowledgeTool implements AgentTool {
  readonly name: AgentTool['name'];
  readonly description: AgentTool['description'];
  readonly parameters: AgentTool['parameters'];
  readonly returns: AgentTool['returns'];
  readonly notes?: AgentTool['notes'];
  readonly upstream = SEARCH_KNOWLEDGE_CONTRACT.upstream;

    private readonly legacy: LegacyFacade
  constructor(
    legacy: LegacyFacade
  ) {
    this.legacy = legacy

    const base = toolFromContract(SEARCH_KNOWLEDGE_CONTRACT, (input, ctx) =>
      this.run(input, ctx),
    );
    this.name = base.name;
    this.description = base.description;
    this.parameters = base.parameters;
    this.returns = base.returns;
    this.notes = base.notes;
  }

  execute(input: Record<string, unknown>, ctx?: RequestContext): Promise<unknown> {
    return this.run(input, ctx);
  }

  private run(input: Record<string, unknown>, ctx?: RequestContext) {
    const query = String(input.query ?? '').trim();
    const isStandard =
      typeof input.isStandard === 'boolean' ? input.isStandard : undefined;
    const topicHint = String(input.topicHint ?? '').trim() || undefined;
    const skipRewrite = input.skipRewrite === true;
    return this.legacy.searchKnowledge({
      query,
      isStandard,
      topicHint: skipRewrite ? undefined : topicHint,
      skipRewrite,
      ctx: ctx ?? {},
    }).then((result) => ({
      ...result,
      query: String(result.query ?? query).trim() || query,
    }));
  }
}
