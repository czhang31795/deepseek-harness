import type { RequestContext } from '../../../common/types/request-context';
import { LegacyFacade } from '../../../legacy/legacy.facade';
import { GET_MATERIAL_SUPPLIER_FILTERS_CONTRACT } from '../specs/material/get-material-supplier-filters.contract';
import type { AgentTool } from '../tool.types';
import { toolFromContract } from '../tool.types';

export class GetMaterialSupplierFiltersTool implements AgentTool {
  readonly name: AgentTool['name'];
  readonly description: AgentTool['description'];
  readonly parameters: AgentTool['parameters'];
  readonly returns: AgentTool['returns'];
  readonly notes?: AgentTool['notes'];
  readonly upstream = GET_MATERIAL_SUPPLIER_FILTERS_CONTRACT.upstream;

    private readonly legacy: LegacyFacade
  constructor(
    legacy: LegacyFacade
  ) {
    this.legacy = legacy

    const base = toolFromContract(
      GET_MATERIAL_SUPPLIER_FILTERS_CONTRACT,
      (_input, ctx) => this.run(ctx),
    );
    this.name = base.name;
    this.description = base.description;
    this.parameters = base.parameters;
    this.returns = base.returns;
    this.notes = base.notes;
  }

  execute(_input: Record<string, unknown>, ctx?: RequestContext): Promise<unknown> {
    return this.run(ctx);
  }

  private async run(ctx?: RequestContext) {
    const filters = await this.legacy.getMaterialSupplierFilters({
      ctx: ctx ?? {},
    });
    return {
      resource: 'material-supplier-filters',
      applicationAreas: filters.applicationAreas,
      usage:
        '从 applicationAreas 选应用领域，再带 applicationArea 调用 search_material_suppliers。取值必须用本次返回，不要编领域。',
    };
  }
}
