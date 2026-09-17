import type { RequestContext } from '../../../common/types/request-context';
import {
  MATERIAL_DEFAULT_PAGE_SIZE,
  type MaterialSupplierSearchQuery,
} from '../../../domain/material';
import { LegacyFacade } from '../../../legacy/legacy.facade';
import { SEARCH_MATERIAL_SUPPLIERS_CONTRACT } from '../specs/material/search-material-suppliers.contract';
import type { AgentTool } from '../tool.types';
import { toolFromContract } from '../tool.types';

export class SearchMaterialSuppliersTool implements AgentTool {
  readonly name: AgentTool['name'];
  readonly description: AgentTool['description'];
  readonly parameters: AgentTool['parameters'];
  readonly returns: AgentTool['returns'];
  readonly notes?: AgentTool['notes'];
  readonly upstream = SEARCH_MATERIAL_SUPPLIERS_CONTRACT.upstream;

    private readonly legacy: LegacyFacade
  constructor(
    legacy: LegacyFacade
  ) {
    this.legacy = legacy

    const base = toolFromContract(
      SEARCH_MATERIAL_SUPPLIERS_CONTRACT,
      (input, ctx) => this.run(input, ctx),
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
    const query: MaterialSupplierSearchQuery = {
      applicationArea: asTrimmed(input.applicationArea),
      supplier: asTrimmed(input.supplier),
      page: Number(input.page) || 1,
      pageSize: Number(input.pageSize) || MATERIAL_DEFAULT_PAGE_SIZE,
      ctx: ctx ?? {},
    };
    return this.legacy.searchMaterialSuppliers(query);
  }
}

function asTrimmed(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}
