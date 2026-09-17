import type { JsonSchema } from '../../tool.types';

export const MATERIAL_FILE_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['fileUrl'],
  properties: {
    token: { type: 'string' },
    fileName: { type: 'string' },
    fileUrl: {
      type: 'string',
      description: '样板图绝对 URL，已带 TDS /hreaderFile 前缀，可直接给用户打开',
    },
  },
};

/** 列表行白名单。Adapter 不得把 SELECT * 或 price_factor 回给模型。 */
export const MATERIAL_LIST_ITEM_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['materialCode', 'sourceSystem', 'sampleImages', 'hasDatasheet'],
  properties: {
    materialCode: {
      type: 'string',
      description: '物料编码。上游列名拼写是 pxy2_matrialcode。',
    },
    rawType: { type: 'string', description: '材料分类，如 塑料。取值来自 filters.rawTypes' },
    materialName: { type: 'string', description: '材料名称，如 PC' },
    spec: { type: 'string', description: '规格' },
    color: { type: 'string', description: '颜色' },
    colorNo: { type: 'string', description: '色号。塑料常见，其它类型可能没有' },
    supplier: { type: 'string', description: '供应商库内名' },
    origin: { type: 'string', description: '产地' },
    lightTransmission: { type: 'string', description: '透光性。塑料常见' },
    isVendorL2: { type: 'string', description: '是否二级供应商' },
    sampleImages: {
      type: 'array',
      items: MATERIAL_FILE_SCHEMA,
      description: '样板图。塑料常见，其它类型可能为空',
    },
    hasDatasheet: {
      type: 'boolean',
      description: '是否有物性表。真正预览/下载走 list_material_files，本字段只表示有无。',
    },
    application: { type: 'string', description: '应用说明' },
    sourceSystem: { type: 'string' },
  },
};

export const MATERIAL_PARAMETER_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'group', 'value'],
  properties: {
    name: { type: 'string', description: '参数名称' },
    group: { type: 'string', description: '一级分类，如 物理性能' },
    subgroup: { type: 'string', description: '二级分类' },
    testStandard: { type: 'string', description: '测试标准' },
    testCondition: { type: 'string', description: '测试条件' },
    unit: { type: 'string', description: '单位' },
    value: { type: 'string', description: '数值。TBD=待补充，NA=无数据' },
    explanation: { type: 'string', description: '参数解释' },
  },
};
