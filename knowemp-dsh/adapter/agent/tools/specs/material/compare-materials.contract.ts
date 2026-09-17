import type { ToolContract } from '../../tool.types';

export const COMPARE_MATERIALS_CONTRACT: ToolContract = {
  name: 'compare_materials',
  summary:
    '按 2～5 个物料编码对比 TDS 材料参数。rawType（材料分类）必填，必须来自 get_material_filters.rawTypes 或检索行的 rawType，不要猜测。编码必须来自 search_materials。',
  upstream: {
    system: 'tds',
    method: 'POST',
    path: '/tds/serve/materialInfo',
    mode: 'get_material_info_by_codes',
  },
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['materialCodes', 'rawType'],
    properties: {
      materialCodes: {
        type: 'array',
        minItems: 2,
        maxItems: 5,
        items: { type: 'string' },
        description: '2～5 个物料编码。',
      },
      rawType: {
        type: 'string',
        description: '材料分类，接口必填。取值必须来自筛选项或检索行，禁止编造。',
      },
    },
  },
  returns: {
    type: 'object',
    additionalProperties: false,
    required: ['resource', 'columns', 'rows'],
    properties: {
      resource: { type: 'string', enum: ['material'] },
      rawType: { type: 'string' },
      columns: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['materialCode'],
          properties: {
            materialCode: { type: 'string' },
            materialName: { type: 'string' },
            spec: { type: 'string' },
            color: { type: 'string' },
          },
        },
      },
      rows: {
        type: 'array',
        description: '对比行。values 的 key 是物料编码。',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'group', 'values'],
          properties: {
            name: { type: 'string' },
            group: { type: 'string' },
            subgroup: { type: 'string' },
            unit: { type: 'string' },
            values: {
              type: 'object',
              additionalProperties: true,
              description: '物料编码 → 数值',
            },
          },
        },
      },
      error: { type: 'string', description: 'missing_raw_type / invalid_codes' },
      message: { type: 'string' },
    },
  },
  notes: [
    '没有材料分类时先 get_material_filters 或请用户点选，不要猜成塑料。',
    '对比结果不含价格系数。',
    '回答用 Markdown 对比表，列是物料编码，行是参数。',
  ],
};
