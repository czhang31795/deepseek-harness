import type { ToolContract } from '../../tool.types';
import { MATERIAL_FILE_SCHEMA } from './material-item.schema';

export const SEARCH_MATERIAL_SUPPLIERS_CONTRACT: ToolContract = {
  name: 'search_material_suppliers',
  summary:
    '检索 TDS「材料供应商」名录卡片。applicationArea 必须来自 get_material_supplier_filters；supplier 只传厂名短词。无条件也可查第一页，pageSize 默认 5，不要开全库大页。电话/邮箱受部门权限控制，见 contactPermission。',
  upstream: {
    system: 'tds',
    method: 'POST',
    path: '/tds/serve/materialSupplier',
    mode: 'get_material_supplier_list',
  },
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      applicationArea: {
        type: 'string',
        description:
          '应用领域精确值。必须用 get_material_supplier_filters.applicationAreas。不要传材料参数库的 rawType（塑料/涂料）。',
      },
      supplier: {
        type: 'string',
        description: '供应商名称短词，现网 like。禁止把整句用户问题当名称。',
      },
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
        description: '页码，从 1 开始。Adapter 转 page_token=(page-1)*pageSize',
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
    required: ['resource', 'totals', 'page', 'pageSize', 'list', 'contactPermission'],
    properties: {
      resource: { type: 'string', enum: ['material-supplier'] },
      totals: { type: 'number', description: '命中总数，可能大于 list.length' },
      page: { type: 'number' },
      pageSize: { type: 'number' },
      contactPermission: {
        type: 'string',
        enum: ['granted', 'denied'],
        description:
          '是否可看电话邮箱。denied 时必须告诉用户没有权限，不要编号码。',
      },
      contactPermissionMessage: {
        type: 'string',
        description: '给模型的权限说明，转述给用户时用「没有权限查看」。',
      },
      list: {
        type: 'array',
        description: '当前页供应商卡片。电话邮箱仅在有权限时出现。',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'sourceSystem', 'logos', 'intros'],
          properties: {
            name: { type: 'string', description: '库内名，对应上游 supplier' },
            applicationArea: { type: 'string', description: '应用领域' },
            nameZh: { type: 'string', description: '中文全称' },
            nameEn: { type: 'string', description: '英文全称' },
            website: {
              type: 'string',
              description: '官网 http(s) URL，可直接打开',
            },
            contact: { type: 'string', description: '联系人姓名' },
            contactPhone: {
              type: 'string',
              description: '仅 contactPermission=granted 时出现',
            },
            contactMail: {
              type: 'string',
              description: '仅 contactPermission=granted 时出现',
            },
            logos: {
              type: 'array',
              items: MATERIAL_FILE_SCHEMA,
              description: 'Logo，已带 /hreaderFile',
            },
            intros: {
              type: 'array',
              items: MATERIAL_FILE_SCHEMA,
              description: '公司简介附件，已带 /hreaderFile',
            },
            sourceSystem: { type: 'string' },
          },
        },
      },
    },
  },
  notes: [
    '没有单独详情接口，列表行已是全量卡片字段。',
    '电话/邮箱看 contactPermission。denied：明确说没有权限查看，不要编造，不要说成工具没有该字段。granted：用户问到才给 contactPhone/contactMail。',
    '界面会展示 Logo / 简介链接，正文不要贴 URL 长串。',
    '查物料行上的厂名（如 Sabic）请用 search_materials，不要用本工具。',
  ],
};
