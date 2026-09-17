import type { ToolContract } from '../../tool.types';
import {
  LIGHT_SOURCE_COLUMN_SCHEMA,
  LIGHT_SOURCE_ITEM_SCHEMA,
  RANGE_SCHEMA,
  SORT_FIELD_ENUM,
} from './light-source-item.schema';

export const SEARCH_LIGHT_SOURCES_CONTRACT: ToolContract = {
  name: 'search_light_sources',
  summary:
    '按关键词和结构化条件检索 TDS 光学光源库。keyword 只传短词（型号片段、供应商、光色、物料号），禁止传整句。光色/供应商取值优先来自 get_light_source_filters。查某主机厂推荐光源时填 recommendHost + lampType。',
  upstream: {
    system: 'tds',
    method: 'POST',
    path: '/tds/serve/lightSource',
    mode: 'get_light_source_list',
  },
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      keyword: {
        type: 'string',
        description:
          '对应 TDS target。模糊匹配产品型号、品名、物料编码。短词有效，整句常返回空。',
      },
      colors: {
        type: 'array',
        items: { type: 'string' },
        description: '产品光色 PRODUCTLIGHTCOLOR，如 ["red","PC Amber"]。取值用 filters 返回的 value。',
      },
      suppliers: {
        type: 'array',
        items: { type: 'string' },
        description:
          '供应商 SUPPLIER。必须用 get_light_source_filters.suppliers.name 或 vendorPolicy.brands[].supplier，不要传选型文中文厂名。',
      },
      massProduction: {
        type: 'array',
        items: { type: 'string' },
        description: '是否已量产，取值用 filters.massProduction',
      },
      luminousAngles: {
        type: 'array',
        items: { type: 'number' },
        description: '发光角度精确值列表',
      },
      models: {
        type: 'array',
        items: { type: 'string' },
        description: '按产品型号精确匹配（in）。一般由推荐逻辑使用，不要把用户整句塞进来。',
      },
      consumePowerW: { ...RANGE_SCHEMA, description: '消耗功率 POWERTJ25 (W)' },
      productPowerW: { ...RANGE_SCHEMA, description: '产品功率 PRODUCTPOWER (W)' },
      fluxMaxLm: { ...RANGE_SCHEMA, description: '最大光通量冷流明' },
      fluxMinLm: { ...RANGE_SCHEMA, description: '最小光通量冷流明' },
      fluxTypicalLm: { ...RANGE_SCHEMA, description: '常用光通量热流明' },
      lengthMm: { ...RANGE_SCHEMA, description: '长度 mm' },
      widthMm: { ...RANGE_SCHEMA, description: '宽度 mm' },
      heightMm: { ...RANGE_SCHEMA, description: '高度 mm' },
      maxTjC: { ...RANGE_SCHEMA, description: 'Max Tj (°C)' },
      recommendHost: {
        type: 'string',
        description:
          '主机厂名称。填写后按该主机厂推荐品牌/型号过滤。主机厂名单来自 get_light_source_filters.hosts 或 get_host_recommend_info。',
      },
      lampType: {
        type: 'string',
        enum: ['hl', 'sl'],
        description:
          '与 recommendHost 一起用。hl=前灯，sl=信号灯。不传则合并前灯+信号灯推荐。',
      },
      market: {
        type: 'string',
        enum: ['out', 'in'],
        description:
          '与 recommendHost 一起用。out=出口，in=国内。不传则合并出口+国内。',
      },
      sort: {
        type: 'object',
        additionalProperties: false,
        properties: {
          field: {
            type: 'string',
            enum: [...SORT_FIELD_ENUM],
            description: '排序字段，默认 recommendLevel',
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: '默认 desc',
          },
          nulls: {
            type: 'string',
            enum: ['first', 'last'],
            description: '空值排前或排后。不传则按数据库默认。',
          },
        },
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
      includeP2pSiblings: {
        type: 'boolean',
        default: false,
        description:
          'true 时把同类 Pin-to-Pin 行插入列表（isP2pSibling=true）。默认 false。查替代件请用 get_light_source_p2p。',
      },
    },
  },
  returns: {
    type: 'object',
    additionalProperties: false,
    required: ['totals', 'page', 'pageSize', 'columns', 'list'],
    properties: {
      totals: { type: 'number', description: '命中总数，可能大于 list.length' },
      page: { type: 'number' },
      pageSize: { type: 'number' },
      columns: {
        type: 'array',
        description:
          '本次显示列，来自 TDS field 字典。行上的数据 key 与 columns[].key 一致。',
        items: LIGHT_SOURCE_COLUMN_SCHEMA,
      },
      list: {
        type: 'array',
        description: '当前页光源。只含 field 字典中的列，外加 itemId。',
        items: LIGHT_SOURCE_ITEM_SCHEMA,
      },
      appliedRecommend: {
        type: 'object',
        description: '若使用了 recommendHost，回传实际套用的推荐品牌/型号，便于核对。',
        additionalProperties: false,
        properties: {
          host: { type: 'string' },
          lampType: { type: ['string', 'null'] },
          market: { type: ['string', 'null'] },
          brands: { type: 'array', items: { type: 'string' } },
          extraModels: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  notes: [
    'TDS target 对短词更有效；整句查询常返回空。',
    '部分光色词（如 yellow）用 keyword 可能 miss，改用 colors=["yellow"] 或相近词 amber，再用返回的 PRODUCTLIGHTCOLOR 核对。',
    'filters 在 TDS 侧没有字段白名单，Adapter 必须把本工具参数翻译成允许的列，禁止把模型编造的字段名传给 TDS。',
    'page_token 是 offset 不是游标。',
    '回答只使用 list / columns 中真实出现的字段（如 PRODUCTMODEL、xy2_PinToPin），不要编造未返回的型号。',
    '列举默认 pageSize=5；用户明确要求更多再加大。',
    'suppliers 优先传 vendorPolicy.brands[].supplier；若误传中文厂名，Adapter 会按 brandAliases 尝试映射到库内名。',
  ],
};
