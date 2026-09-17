import type { ToolContract } from '../../tool.types';

export const GET_MATERIAL_SUPPLIER_FILTERS_CONTRACT: ToolContract = {
  name: 'get_material_supplier_filters',
  summary:
    '获取 TDS「材料供应商」页的应用领域筛选项。这不是材料参数库的分类/供应商字段。search_material_suppliers.applicationArea 必须用本次返回值，不要编领域名单。',
  upstream: {
    system: 'tds',
    method: 'POST',
    path: '/tds/serve/materialSupplier',
    mode: 'get_basic_filter_info',
  },
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
  returns: {
    type: 'object',
    additionalProperties: false,
    required: ['resource', 'applicationAreas'],
    properties: {
      resource: { type: 'string', enum: ['material-supplier-filters'] },
      applicationAreas: {
        type: 'array',
        items: { type: 'string' },
        description: '应用领域，如 塑料粒子。search.applicationArea 必须用这里的值。',
      },
      usage: {
        type: 'string',
        description: '如何继续调用',
      },
    },
  },
  notes: [
    '对应 TDS 材料模块的供应商名录页，不是 search_materials 行上的 supplier。',
    '不要用本工具查卡片列表，列表请用 search_material_suppliers。',
    '不要编造应用领域；用户说了领域也要先对照本次返回值再检索。',
  ],
};
