import type { ToolContract } from '../../tool.types';
import {
  MATERIAL_LIST_ITEM_SCHEMA,
  MATERIAL_PARAMETER_SCHEMA,
} from './material-item.schema';

export const GET_MATERIAL_DETAIL_CONTRACT: ToolContract = {
  name: 'get_material_detail',
  summary:
    '按物料编码查 TDS 材料详情，把宽表映射成参数/测试标准/条件/单位/数值。materialCode 必须来自 search_materials。不知道分类时也可只传编码，Adapter 会先解析分类。',
  upstream: {
    system: 'tds',
    method: 'POST',
    path: '/tds/serve/materialInfo + /tds/serve/materialInfoClassify',
    mode: 'get_material_info_by_codes + get_material_info_classify_list',
  },
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['materialCode'],
    properties: {
      materialCode: {
        type: 'string',
        description: '物料编码，必须来自检索结果的 materialCode。',
      },
      rawType: {
        type: 'string',
        description: '材料分类。有则直接走对比接口；没有则 Adapter 先按编码解析。',
      },
    },
  },
  returns: {
    type: 'object',
    additionalProperties: false,
    required: ['resource', 'summary', 'parameters'],
    properties: {
      resource: { type: 'string', enum: ['material'] },
      summary: {
        ...MATERIAL_LIST_ITEM_SCHEMA,
        type: ['object', 'null'],
        description: '基本信息白名单。找不到则为 null。',
      },
      parameters: {
        type: 'array',
        description: '性能/参数表行，不含基本信息重复项，不含价格系数。',
        items: MATERIAL_PARAMETER_SCHEMA,
      },
    },
  },
  notes: [
    '回答用 Markdown 表格列出参数，不要编造未返回的测试标准或数值。',
    'TBD 表示待补充，NA 表示无数据，原样告知。',
    '物性表/附件预览下载走 list_material_files，不要根据 hasDatasheet 编链接。',
  ],
};
