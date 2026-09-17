import type { ToolContract } from '../../tool.types';

const brandTypeGroup: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['brands', 'extraModels'],
  properties: {
    brands: {
      type: 'array',
      items: { type: 'string' },
      description: '推荐品牌。search 时可作 suppliers。',
    },
    extraModels: {
      type: 'array',
      description:
        '不在 brands 里的额外推荐型号。search 时可把 models 展开后传入 search_light_sources.models。',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['brand', 'models'],
        properties: {
          brand: { type: 'string' },
          models: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const marketGroup = {
  type: 'object',
  additionalProperties: false,
  required: ['out', 'in'],
  properties: {
    out: { ...brandTypeGroup, description: '出口' },
    in: { ...brandTypeGroup, description: '国内' },
  },
};

export const GET_HOST_RECOMMEND_INFO_CONTRACT: ToolContract = {
  name: 'get_host_recommend_info',
  summary:
    '查询主机厂的前灯/信号灯、出口/国内推荐品牌与额外推荐型号。用户问「某主机厂该用哪些厂的灯」时用本工具；要列出具体物料再调 search_light_sources 并带 recommendHost。',
  upstream: {
    system: 'tds',
    method: 'POST',
    path: '/tds/serve/lightSourceRecommend',
    mode: 'get_host_recommend_info',
  },
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      host: {
        type: 'string',
        description:
          '主机厂名称。不传则返回全部。支持与库内名称互相包含的模糊匹配（Adapter 侧过滤）。',
      },
    },
  },
  returns: {
    type: 'object',
    additionalProperties: false,
    required: ['hosts', 'list'],
    properties: {
      hosts: {
        type: 'array',
        items: { type: 'string' },
        description: '全部主机厂名',
      },
      list: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['host', 'hl', 'sl'],
          properties: {
            no: { type: 'number' },
            host: { type: 'string', description: '主机厂 host_manufacturer' },
            hl: { ...marketGroup, description: '前灯' },
            sl: { ...marketGroup, description: '信号灯' },
          },
        },
      },
    },
  },
  notes: [
    '优先调本 mode，不要用 get_light_source_recommend_list 的原始拼接字符串。',
    'hl=前灯，sl=信号灯；out=出口，in=国内。',
    'extraModels 已去掉推荐品牌自身的型号，只保留其它品牌补推型号。',
    '本工具只读。不要调用推荐表的增删改 mode。',
  ],
};
