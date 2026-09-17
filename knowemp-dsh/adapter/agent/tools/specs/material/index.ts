import type { ToolContract } from '../../tool.types';
import { ANALYZE_MATERIAL_FILE_CHART_CONTRACT } from './analyze-material-file-chart.contract';
import { APPLY_MATERIAL_FILE_ACCESS_CONTRACT } from './apply-material-file-access.contract';
import { COMPARE_MATERIALS_CONTRACT } from './compare-materials.contract';
import { GET_MATERIAL_DETAIL_CONTRACT } from './get-material-detail.contract';
import { GET_MATERIAL_FILTERS_CONTRACT } from './get-material-filters.contract';
import { LIST_MATERIAL_FILES_CONTRACT } from './list-material-files.contract';
import { SEARCH_MATERIALS_CONTRACT } from './search-materials.contract';

export const MATERIAL_TOOL_CONTRACTS: ToolContract[] = [
  GET_MATERIAL_FILTERS_CONTRACT,
  SEARCH_MATERIALS_CONTRACT,
  GET_MATERIAL_DETAIL_CONTRACT,
  COMPARE_MATERIALS_CONTRACT,
  LIST_MATERIAL_FILES_CONTRACT,
  APPLY_MATERIAL_FILE_ACCESS_CONTRACT,
  ANALYZE_MATERIAL_FILE_CHART_CONTRACT,
];

export {
  ANALYZE_MATERIAL_FILE_CHART_CONTRACT,
  APPLY_MATERIAL_FILE_ACCESS_CONTRACT,
  COMPARE_MATERIALS_CONTRACT,
  GET_MATERIAL_DETAIL_CONTRACT,
  GET_MATERIAL_FILTERS_CONTRACT,
  LIST_MATERIAL_FILES_CONTRACT,
  SEARCH_MATERIALS_CONTRACT,
};
