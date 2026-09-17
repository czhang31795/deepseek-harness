import type { RequestContext } from '../../../common/types/request-context';
import { LegacyFacade } from '../../../legacy/legacy.facade';
import { LIST_MATERIAL_FILES_CONTRACT } from '../specs/material/list-material-files.contract';
import type { AgentTool } from '../tool.types';
import { toolFromContract } from '../tool.types';

export class ListMaterialFilesTool implements AgentTool {
  readonly name: AgentTool['name'];
  readonly description: AgentTool['description'];
  readonly parameters: AgentTool['parameters'];
  readonly returns: AgentTool['returns'];
  readonly notes?: AgentTool['notes'];
  readonly upstream = LIST_MATERIAL_FILES_CONTRACT.upstream;

    private readonly legacy: LegacyFacade
  constructor(
    legacy: LegacyFacade
  ) {
    this.legacy = legacy

    const base = toolFromContract(LIST_MATERIAL_FILES_CONTRACT, (input, ctx) =>
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

  private run(
    input: Record<string, unknown>,
    ctx?: RequestContext,
  ): Promise<unknown> {
    return this.legacy.listMaterialFiles({
      materialCode: String(input.materialCode ?? '').trim(),
      ctx: ctx ?? {},
    });
  }
}
