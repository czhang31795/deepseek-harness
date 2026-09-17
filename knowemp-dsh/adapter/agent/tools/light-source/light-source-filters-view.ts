import {
  compactLedBrandAliases,
  learnLedBrandAlias,
} from '../../../domain/led-brand';
import type { LightSourceFilters } from '../../../domain/light-source';
import type { VendorSelectionPolicy } from '../../../domain/vendor-policy';

export function presentFiltersForAgent(
  filters: LightSourceFilters,
  vendorPolicy: VendorSelectionPolicy,
) {
  for (const scenario of vendorPolicy.scenarios) {
    for (const brand of scenario.brands) {
      if (brand.supplier) learnLedBrandAlias(brand.label, brand.supplier);
    }
  }
  return {
    vendorPolicy,
    vendorGuide: (filters.vendorGuide ?? []).map((item) => ({
      title: item.title,
      updateTime: item.updateTime ?? null,
      content: item.content,
    })),
    brandAliases: compactLedBrandAliases(),
    suppliers: filters.suppliers.map((item) => ({
      name: item.name,
      category: item.category,
    })),
    hosts: filters.hosts,
    colors: filters.colors,
    ranges: filters.ranges,
    massProduction: filters.massProduction,
    luminousAngles: filters.luminousAngles,
  };
}
