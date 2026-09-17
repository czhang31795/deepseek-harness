import type { RequestContext } from '../../../common/types/request-context';
import { LegacyFacade } from '../../../legacy/legacy.facade';
import { GET_MATERIAL_FILTERS_CONTRACT } from '../specs/material/get-material-filters.contract';
import type { AgentTool } from '../tool.types';
import { toolFromContract } from '../tool.types';
import { presentMaterialFilters } from './material-filters-view';

export class GetMaterialFiltersTool implements AgentTool {
  readonly name: AgentTool['name'];
  readonly description: AgentTool['description'];
  readonly parameters: AgentTool['parameters'];
  readonly returns: AgentTool['returns'];
  readonly notes?: AgentTool['notes'];
  readonly upstream = GET_MATERIAL_FILTERS_CONTRACT.upstream;

    private readonly legacy: LegacyFacade
  constructor(
    legacy: LegacyFacade
  ) {
    this.legacy = legacy

    const base = toolFromContract(GET_MATERIAL_FILTERS_CONTRACT, (input, ctx) =>
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

  private async run(input: Record<string, unknown>, ctx?: RequestContext) {
    const rawType = asTrimmed(input.rawType);
    const materialName = asTrimmed(input.materialName);
    const spec = asTrimmed(input.spec);
    const color = asTrimmed(input.color);
    const filters = await this.legacy.getMaterialFilters({
      rawType,
      materialName,
      spec,
      color,
      ctx: ctx ?? {},
    });
    return presentMaterialFilters(
      filters,
      Boolean(rawType || materialName || spec || color),
    );
  }
}

function asTrimmed(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}
