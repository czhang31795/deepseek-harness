import type { RequestContext } from '../../../common/types/request-context';
import { LegacyFacade } from '../../../legacy/legacy.facade';
import { GET_MATERIAL_DETAIL_CONTRACT } from '../specs/material/get-material-detail.contract';
import type { AgentTool } from '../tool.types';
import { toolFromContract } from '../tool.types';

export class GetMaterialDetailTool implements AgentTool {
  readonly name: AgentTool['name'];
  readonly description: AgentTool['description'];
  readonly parameters: AgentTool['parameters'];
  readonly returns: AgentTool['returns'];
  readonly notes?: AgentTool['notes'];
  readonly upstream = GET_MATERIAL_DETAIL_CONTRACT.upstream;

    private readonly legacy: LegacyFacade
  constructor(
    legacy: LegacyFacade
  ) {
    this.legacy = legacy

    const base = toolFromContract(GET_MATERIAL_DETAIL_CONTRACT, (input, ctx) =>
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
    return this.legacy.getMaterialDetail({
      materialCode: String(input.materialCode ?? '').trim(),
      rawType: asTrimmed(input.rawType),
      ctx: ctx ?? {},
    });
  }
}

function asTrimmed(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}
