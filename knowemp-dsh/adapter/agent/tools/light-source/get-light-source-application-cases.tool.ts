import { LegacyFacade } from '../../../legacy/legacy.facade';
import { GET_LIGHT_SOURCE_APPLICATION_CASES_CONTRACT } from '../specs/light-source/get-light-source-application-cases.contract';
import type { AgentTool } from '../tool.types';
import { toolFromContract } from '../tool.types';

export class GetLightSourceApplicationCasesTool implements AgentTool {
  readonly name: AgentTool['name'];
  readonly description: AgentTool['description'];
  readonly parameters: AgentTool['parameters'];
  readonly returns: AgentTool['returns'];
  readonly notes?: AgentTool['notes'];
  readonly upstream = GET_LIGHT_SOURCE_APPLICATION_CASES_CONTRACT.upstream;

    private readonly legacy: LegacyFacade
  constructor(
    legacy: LegacyFacade
  ) {
    this.legacy = legacy

    const base = toolFromContract(
      GET_LIGHT_SOURCE_APPLICATION_CASES_CONTRACT,
      (input) => this.run(input),
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
    return this.legacy.getLightSourceApplicationCases({
      model: String(input.model ?? '').trim(),
    });
  }
}
