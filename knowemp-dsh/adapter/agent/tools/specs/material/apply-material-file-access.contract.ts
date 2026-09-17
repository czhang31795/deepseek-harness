import type { ToolContract } from '../../tool.types';

export const APPLY_MATERIAL_FILE_ACCESS_CONTRACT: ToolContract = {
  name: 'apply_material_file_access',
  summary:
    '为当前登录用户申请某份材料附件的查看或下载权限。申请人固定为当前身份，不要传 union_id。',
  upstream: {
    system: 'tds',
    method: 'POST',
    path: '/tds/serve/MaterialInfoFileApply',
    mode: 'addApplyFile',
  },
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['materialCode', 'fileId', 'access'],
    properties: {
      materialCode: {
        type: 'string',
        description: '物料编码，来自 search_materials。',
      },
      fileId: {
        type: 'string',
        description: '必须来自 list_material_files 的 fileId。',
      },
      access: {
        type: 'string',
        enum: ['view', 'download'],
        description: 'view=查看，download=下载。',
      },
      reason: {
        type: 'string',
        description: '申请原因。下载建议填写。',
      },
    },
  },
  returns: {
    type: 'object',
    additionalProperties: false,
    required: ['resource', 'submitted'],
    properties: {
      resource: { type: 'string', enum: ['material-file-apply'] },
      submitted: { type: 'boolean' },
      fileName: { type: 'string' },
      access: { type: 'string', enum: ['view', 'download'] },
      error: {
        type: 'string',
        description:
          'missing_identity / already_granted / file_not_found / missing_file_id / apply_failed',
      },
      message: { type: 'string' },
    },
  },
  notes: [
    'apply_user 只能是当前身份，忽略模型传入的任何申请人字段。',
    '已有对应权限时返回 already_granted，不要重复申请。',
    '不提供审批（通过/驳回）能力。',
  ],
};
