import type {
  MaterialCompareQuery,
  MaterialCompareResult,
  MaterialDetailQuery,
  MaterialDetailView,
  MaterialFileApplyQuery,
  MaterialFileApplyResult,
  MaterialFileChartQuery,
  MaterialFileChartResult,
  MaterialFileListQuery,
  MaterialFileListResult,
  MaterialFilters,
  MaterialFiltersQuery,
  MaterialSearchQuery,
  MaterialSearchResult,
  MaterialSupplierFilters,
  MaterialSupplierFiltersQuery,
  MaterialSupplierSearchQuery,
  MaterialSupplierSearchResult,
} from '../../domain/material';

export type { MaterialSearchQuery };

export interface MaterialPort {
  readonly systemId: string;
  getFilters(query: MaterialFiltersQuery): Promise<MaterialFilters>;
  search(query: MaterialSearchQuery): Promise<MaterialSearchResult>;
  getDetail(query: MaterialDetailQuery): Promise<MaterialDetailView>;
  compare(query: MaterialCompareQuery): Promise<MaterialCompareResult>;
  listFiles(query: MaterialFileListQuery): Promise<MaterialFileListResult>;
  analyzeFileChart(
    query: MaterialFileChartQuery,
  ): Promise<MaterialFileChartResult>;
  applyFileAccess(
    query: MaterialFileApplyQuery,
  ): Promise<MaterialFileApplyResult>;
  getSupplierFilters(
    query: MaterialSupplierFiltersQuery,
  ): Promise<MaterialSupplierFilters>;
  searchSuppliers(
    query: MaterialSupplierSearchQuery,
  ): Promise<MaterialSupplierSearchResult>;
}

export const MATERIAL_PORTS = Symbol('MATERIAL_PORTS');
