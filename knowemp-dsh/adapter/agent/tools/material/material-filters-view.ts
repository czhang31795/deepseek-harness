import type { MaterialFilters } from '../../../domain/material';

export function presentMaterialFilters(
  filters: MaterialFilters,
  cascaded: boolean,
) {
  if (!cascaded) {
    return {
      resource: 'material-filters',
      rawTypes: filters.rawTypes,
      usage:
        '先从 rawTypes 选材料分类，再带 rawType 调用本工具获取材料名称/规格/颜色。search / compare 的精确取值必须用本次返回的值。',
    };
  }
  return {
    resource: 'material-filters',
    rawTypes: filters.rawTypes,
    materialNames: filters.materialNames,
    specs: filters.specs,
    colors: filters.colors,
  };
}
