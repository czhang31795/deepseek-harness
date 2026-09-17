import type { ToolContract } from '../../tool.types';

const ATTACHED_FILE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'fileId',
    'category',
    'name',
    'kind',
    'canView',
    'canDownload',
    'canChart',
  ],
  properties: {
    fileId: {
      type: 'string',
      description: '后续申请/取曲线用的文件标识，来自本清单，不要编造。',
    },
    category: { type: 'string', description: '材料报告 / 材料研究 / 仿真参数 / 应用手册' },
    name: { type: 'string' },
    fileType: { type: 'string' },
    kind: {
      type: 'string',
      enum: ['datasheet', 'report', 'research', 'simulation', 'handbook', 'other'],
      description: 'datasheet 表示物性表（清单里会保留，不要丢掉）',
    },
    canView: { type: 'boolean' },
    canDownload: { type: 'boolean' },
    canChart: { type: 'boolean', description: '可查看且为 Excel 时才能取曲线' },
    viewUrl: { type: 'string', description: '仅 canView=true 时出现' },
    downloadUrl: { type: 'string', description: '仅 canDownload=true 时出现' },
  },
};

export const LIST_MATERIAL_FILES_CONTRACT: ToolContract = {
  name: 'list_material_files',
  summary:
    '按物料编码列出 TDS 材料附件（含物性表），并带上当前登录身份的查看/下载权限。无权时不要编链接。',
  upstream: {
    system: 'tds',
    method: 'POST',
    path: '/tds/serve/materialInfo',
    mode: 'get_material_file',
  },
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['materialCode'],
    properties: {
      materialCode: {
        type: 'string',
        description: '物料编码，必须来自 search_materials。不要传 puid / union_id。',
      },
    },
  },
  returns: {
    type: 'object',
    additionalProperties: false,
    required: ['resource', 'identityPresent', 'files'],
    properties: {
      resource: { type: 'string', enum: ['material-files'] },
      materialCode: { type: 'string' },
      identityPresent: { type: 'boolean' },
      files: { type: 'array', items: ATTACHED_FILE_SCHEMA },
      error: {
        type: 'string',
        description:
          'missing_identity / unknown_user / not_found / missing_puid / missing_code / list_failed',
      },
      message: { type: 'string' },
    },
  },
  notes: [
    '身份由服务端从登录会话注入，禁止在参数里传 union_id。',
    'error=missing_identity 时说明需要登录，不要编预览/下载地址。',
    'canView/canDownload 为 false 时没有 URL；用户要看或下载再走 apply_material_file_access。',
    '物性表会包含在清单里（kind=datasheet），不要按文件名过滤掉。',
  ],
};
