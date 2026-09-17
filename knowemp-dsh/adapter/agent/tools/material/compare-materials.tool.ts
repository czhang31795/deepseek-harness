import type { RequestContext } from '../../../common/types/request-context';
import { LegacyFacade } from '../../../legacy/legacy.facade';
import { COMPARE_MATERIALS_CONTRACT } from '../specs/material/compare-materials.contract';
import type { AgentTool } from '../tool.types';
import { toolFromContract } from '../tool.types';

export class CompareMaterialsTool implements AgentTool {
  readonly name: AgentTool['name'];
  readonly description: AgentTool['description'];
  readonly parameters: AgentTool['parameters'];
  readonly returns: AgentTool['returns'];
  readonly notes?: AgentTool['notes'];
  readonly upstream = COMPARE_MATERIALS_CONTRACT.upstream;

    private readonly legacy: LegacyFacade
  constructor(
    legacy: LegacyFacade
  ) {
    this.legacy = legacy

    const base = toolFromContract(COMPARE_MATERIALS_CONTRACT, (input, ctx) =>
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
    return this.legacy.compareMaterials({
      materialCodes: asStringArray(input.materialCodes),
      rawType: String(input.rawType ?? '').trim(),
      ctx: ctx ?? {},
    });
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}
