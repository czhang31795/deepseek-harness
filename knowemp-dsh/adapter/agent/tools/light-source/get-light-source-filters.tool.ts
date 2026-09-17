import { VendorPolicyExtractor } from '../../vendor-policy.extractor';
import type { LightSourceFilters } from '../../../domain/light-source';
import { LegacyFacade } from '../../../legacy/legacy.facade';
import { GET_LIGHT_SOURCE_FILTERS_CONTRACT } from '../specs/light-source/get-light-source-filters.contract';
import type { AgentTool } from '../tool.types';
import { toolFromContract } from '../tool.types';
import { presentFiltersForAgent } from './light-source-filters-view';

export class GetLightSourceFiltersTool implements AgentTool {
  readonly name: AgentTool['name'];
  readonly description: AgentTool['description'];
  readonly parameters: AgentTool['parameters'];
  readonly returns: AgentTool['returns'];
  readonly notes?: AgentTool['notes'];
  readonly upstream = GET_LIGHT_SOURCE_FILTERS_CONTRACT.upstream;

    private readonly legacy: LegacyFacade
  private readonly vendorPolicyExtractor: VendorPolicyExtractor
  constructor(
    legacy: LegacyFacade,
    vendorPolicyExtractor: VendorPolicyExtractor
  ) {
    this.legacy = legacy
    this.vendorPolicyExtractor = vendorPolicyExtractor

    const base = toolFromContract(GET_LIGHT_SOURCE_FILTERS_CONTRACT, (input) =>
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

  private async run(input: Record<string, unknown>) {
    const filters = await this.legacy.getLightSourceFilters({
      includeVendorGuide: input.includeVendorGuide !== false,
    });
    const vendorPolicy = await this.vendorPolicyExtractor.extract(filters);
    return presentFiltersForAgent(filters, vendorPolicy);
  }
}
