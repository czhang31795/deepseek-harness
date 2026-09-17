import { LegacyFacade } from '../../../legacy/legacy.facade';
import { GET_HOST_RECOMMEND_INFO_CONTRACT } from '../specs/light-source/get-host-recommend-info.contract';
import type { AgentTool } from '../tool.types';
import { toolFromContract } from '../tool.types';

export class GetHostRecommendInfoTool implements AgentTool {
  readonly name: AgentTool['name'];
  readonly description: AgentTool['description'];
  readonly parameters: AgentTool['parameters'];
  readonly returns: AgentTool['returns'];
  readonly notes?: AgentTool['notes'];
  readonly upstream = GET_HOST_RECOMMEND_INFO_CONTRACT.upstream;

    private readonly legacy: LegacyFacade
  constructor(
    legacy: LegacyFacade
  ) {
    this.legacy = legacy

    const base = toolFromContract(GET_HOST_RECOMMEND_INFO_CONTRACT, (input) =>
      this.run(input),
    );
    this.name = base.name;
    this.description = base.description;
    this.parameters = base.parameters;
    this.returns = base.returns;
    this.notes = base.notes;
  }

  execute(input: Record<string, unknown>): Promise<unknown> {
    return this.run(input);
  }

  private run(input: Record<string, unknown>): Promise<unknown> {
    const host = input.host != null ? String(input.host).trim() : undefined;
    return this.legacy.getHostRecommendInfo({ host: host || undefined });
  }
}
