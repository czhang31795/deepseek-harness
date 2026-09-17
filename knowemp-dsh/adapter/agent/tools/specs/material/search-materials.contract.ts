import type { ToolContract } from '../../tool.types';
import { MATERIAL_LIST_ITEM_SCHEMA } from './material-item.schema';

export const SEARCH_MATERIALS_CONTRACT: ToolContract = {
  name: 'search_materials',
  summary:
    '按短关键词和级联条件检索 TDS 材料参数库。keyword 只传短词（物料编码、材料名称、规格、颜色、色号），禁止传整句。精确筛选取值必须来自 get_material_filters。无关键词且无筛选时上游返回空，不要空搜全库。pageSize 默认 5。',
  upstream: {
    system: 'tds',
    method: 'POST',
    path: '/tds/serve/materialInfo',
    mode: 'get_material_info_list',
  },
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      keyword: {
        type: 'string',
        description:
          '对应 TDS search_value。模糊匹配物料编码、名称、规格、颜色、色号。短词有效，整句常返回空。',
      },
      rawType: {
        type: 'string',
        description: '材料分类精确匹配。必须用 get_material_filters.rawTypes 的值。',
      },
      materialName: {
        type: 'string',
        description: '材料名称精确匹配。必须用 filters.materialNames。',
      },
      spec: {
        type: 'string',
        description: '规格精确匹配。必须用 filters.specs。',
      },
      color: {
        type: 'string',
        description: '颜色精确匹配。必须用 filters.colors。',
      },
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
        description: '页码，从 1 开始。Adapter 转 TDS page_token=(page-1)*pageSize',
      },
      pageSize: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        default: 5,
        description: '每页条数，默认 5，最大 50。未要求更多时不要主动加大',
      },
    },
  },
  returns: {
    type: 'object',
    additionalProperties: false,
    required: ['resource', 'totals', 'page', 'pageSize', 'list'],
    properties: {
      resource: { type: 'string', enum: ['material'] },
      totals: { type: 'number', description: '命中总数，可能大于 list.length' },
      page: { type: 'number' },
      pageSize: { type: 'number' },
      list: {
        type: 'array',
        description: '当前页材料。只含白名单字段，不含价格系数。',
        items: MATERIAL_LIST_ITEM_SCHEMA,
      },
    },
  },
  notes: [
    'TDS search_value 对短词更有效，且已不区分大小写；禁止把用户整句当 keyword。',
    '用户说的「黄色」「白色」往往不是库内色名。必须用 get_material_filters.colors 里含该字的值（如黄色→黄绿色透明），不要把「黄色」当 keyword 再叠 rawType，否则常为 0 条。',
    '不要同时传 materialName+spec+color 做第一次检索；过严时会空。先牌号或颜色，空了再放宽。',
    'page_token 是 offset 不是游标。',
    '列表不含 price_factor。回答只用 list 中真实出现的字段。',
    '塑料常见色号/透光性/样板图，其它分类可能没有这些字段。',
    '无关键词且四个筛选都空时不要调用（或接受空结果），不要试图开全库浏览。',
    '看参数表用 get_material_detail；对比用 compare_materials（必须带 rawType）。',
  ],
};
