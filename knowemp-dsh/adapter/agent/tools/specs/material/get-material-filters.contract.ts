import type { ToolContract } from '../../tool.types';

export const GET_MATERIAL_FILTERS_CONTRACT: ToolContract = {
  name: 'get_material_filters',
  summary:
    '获取 TDS 材料参数库的级联筛选项。未选分类时只返回 rawTypes；选定 rawType 后再调一次拿材料名称/规格/颜色。search / compare 的精确取值必须来自本次返回，不要凭记忆编分类或规格。',
  upstream: {
    system: 'tds',
    method: 'POST',
    path: '/tds/serve/materialInfo',
    mode: 'get_filter_info',
  },
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      rawType: {
        type: 'string',
        description: '材料分类，必须是上一轮 rawTypes 里的值。传入后返回该分类下的名称/规格/颜色。',
      },
      materialName: {
        type: 'string',
        description: '材料名称，级联缩小规格和颜色。必须来自本工具 materialNames。',
      },
      spec: {
        type: 'string',
        description: '规格，级联缩小颜色。必须来自本工具 specs。',
      },
      color: {
        type: 'string',
        description: '颜色。必须来自本工具 colors。',
      },
    },
  },
  returns: {
    type: 'object',
    additionalProperties: false,
    required: ['resource', 'rawTypes'],
    properties: {
      resource: { type: 'string', enum: ['material-filters'] },
      rawTypes: {
        type: 'array',
        items: { type: 'string' },
        description: '材料分类。search.rawType / compare.rawType 必须用这里的值。',
      },
      materialNames: {
        type: 'array',
        items: { type: 'string' },
        description: '材料名称。未传 rawType 时不返回，避免把全库规格一次塞给模型。',
      },
      specs: {
        type: 'array',
        items: { type: 'string' },
        description: '规格可选值',
      },
      colors: {
        type: 'array',
        items: { type: 'string' },
        description: '颜色可选值',
      },
      usage: {
        type: 'string',
        description: '如何继续调用',
      },
    },
  },
  notes: [
    '筛选项来自当前库，不是写死枚举。分类展示顺序以上游为准，不要在回答里假定只有某几类。',
    '没有分类时先用本工具拿 rawTypes；有分类后再带 rawType 取名称/规格/颜色。',
    '不要用本工具查物料列表，列表请用 search_materials。',
  ],
};
