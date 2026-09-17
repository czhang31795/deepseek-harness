import type { ToolContract } from '../../tool.types';
import { LIGHT_SOURCE_COLUMN_SCHEMA, LIGHT_SOURCE_ITEM_SCHEMA } from './light-source-item.schema';

export const GET_LIGHT_SOURCE_P2P_CONTRACT: ToolContract = {
  name: 'get_light_source_p2p',
  summary:
    '按 PIN-TO-PIN 编码查询封装兼容/近似光源。pinToPin 必须来自 search_light_sources 返回的 xy2_PinToPin，不要手编。',
  upstream: {
    system: 'tds',
    method: 'POST',
    path: '/tds/serve/lightSource',
    mode: 'get_light_source_p2p_list',
  },
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['pinToPin'],
    properties: {
      pinToPin: {
        type: 'string',
        description: 'TDS xy2_PinToPin。来自行数据 xy2_PinToPin。',
      },
      lightColor: {
        type: 'string',
        description: '可选，按产品光色再过滤。TDS 字段 PRODUCTLIGHTCOLOR。当前 TDS 页面默认不传。',
      },
    },
  },
  returns: {
    type: 'object',
    additionalProperties: false,
    required: ['columns', 'list', 'colors'],
    properties: {
      columns: {
        type: 'array',
        description: '本次显示列，来自 TDS field 字典。',
        items: LIGHT_SOURCE_COLUMN_SCHEMA,
      },
      list: {
        type: 'array',
        description: '替代件列表。p2pMatch：1=完全相同封装，2=近封装。',
        items: LIGHT_SOURCE_ITEM_SCHEMA,
      },
      colors: {
        type: 'array',
        items: { type: 'string' },
        description: '这些替代件里出现过的光色，对应 TDS options',
      },
    },
  },
  notes: [
    '本工具的 pinToPin 是字符串编码，和 search_light_sources.includeP2pSiblings（布尔）不是一回事。',
    'TDS 用去掉最后一位后的前缀做 like 匹配。',
    '无编码或编码为空时不要调用。',
  ],
};
