import type { JsonSchema } from '../../tool.types';

/** 数值区间（闭区间）。只传 min 或只传 max 也可以。 */
export const RANGE_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    min: { type: 'number', description: '下限，含。可只传这一项。' },
    max: { type: 'number', description: '上限，含。可只传这一项。' },
  },
};

export const LIGHT_SOURCE_COLUMN_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['key', 'title'],
  properties: {
    key: { type: 'string', description: 'TDS 列名，如 PRODUCTMODEL' },
    title: { type: 'string', description: '中文列名，如 产品型号' },
  },
};

/**
 * 行字段跟同一次结果的 columns / TDS field 字典走。
 * 不要假设固定英文别名；型号看 PRODUCTMODEL，光色看 PRODUCTLIGHTCOLOR。
 */
export const LIGHT_SOURCE_ITEM_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['itemId', 'sourceSystem'],
  properties: {
    itemId: { type: 'string', description: '零组件编码 ITEMID' },
    sourceSystem: {
      type: 'string',
      enum: ['tds'],
      description: '来源系统，固定 tds',
    },
    isP2pSibling: {
      type: 'boolean',
      description:
        '是否为 Pin-to-Pin 展开出来的同类封装行。仅 search 时 includeP2pSiblings=true 可能出现。',
    },
    p2pMatch: {
      type: 'integer',
      enum: [1, 2],
      description:
        '仅 get_light_source_p2p：1=与传入 pinToPin 完全相同；2=前缀相同的近封装。',
    },
  },
};

export const SORT_FIELD_ENUM = [
  'seriesName',
  'productModel',
  'recommendLevel',
  'costFactor',
  'forwardCurrentMa',
  'productPowerW',
  'lightColor',
  'lengthMm',
  'widthMm',
  'heightMm',
  'luminousMode',
  'ledBrand',
  'supplier',
  'consumePowerW',
  'luminousAngle',
  'fluxTypicalLm',
] as const;
