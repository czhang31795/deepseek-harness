import type { ToolContract } from '../../tool.types';

export const SEARCH_KNOWLEDGE_CONTRACT: ToolContract = {
  name: 'search_knowledge',
  summary:
    '检索 KMS 知识库。①技术标准（知识空间名称多为 xxx标准）：星宇内部技术要求，以及主机厂/国际/国家/行业标准。②制度与生产知识（制度规范库、生产知识库等）：企业文化、管理制度、生产经验。query 用短问题或关键词，禁止把整句闲聊当检索词。不要用本工具查 TDS 材料、光源或供应商名录。',
  upstream: {
    system: 'kms',
    method: 'POST',
    path: '/open-apis/aily/v1/apps/{app_id}/skills/{skill_id}/start',
  },
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['query'],
    properties: {
      query: {
        type: 'string',
        description:
          '要检索的问题或关键词。保留产品型号、项目名里的数字和完整名称，不要省略，例如「EHV后组合灯2灯罩高温酒精试验开裂」。',
      },
    },
  },
  returns: {
    type: 'object',
    additionalProperties: false,
    required: ['resource', 'source', 'configured', 'hasAnswer', 'chunks'],
    properties: {
      resource: { type: 'string', enum: ['knowledge'] },
      source: { type: 'string', enum: ['kms'] },
      configured: {
        type: 'boolean',
        description: '是否已配置飞书应用与 Aily AppID',
      },
      hasAnswer: { type: 'boolean' },
      answer: {
        type: 'string',
        description: '不再使用。总结由本地模型根据相关 chunks 生成。',
      },
      query: {
        type: 'string',
        description: '实际发给知识库的检索词',
      },
      recalledCount: {
        type: 'number',
        description: '飞书原始召回条数（过滤前）',
      },
      chunks: {
        type: 'array',
        items: { type: 'string' },
        description: '召回的知识切片。作答前先筛掉与用户问题无关的项。',
      },
      error: { type: 'string' },
      message: { type: 'string' },
    },
  },
  notes: [
    '命中后按用户问题作答：条文以相关切片为准，可应用到用户条件上；保留图片/代码块/表格，先筛掉无关切片。',
    '默认同时检索标准库（xxx标准）和其他库（制度规范、生产知识）。切片标题会带【标准库】或【其他库】。只有用户点选某一类时才只搜一路。',
    '口语问题会先改写成制度/规范检索词再搜（如「出卖机密」→「保密 泄密 处罚」）；产品型号和标准号会保留。',
    'query 用短关键词；不要把行程、地点规划当检索词。',
    'hasAnswer=false 时如实说明知识库没有，不要编制度条文。',
    'error=not_configured 时说明尚未配置飞书 Aily（KMS 访问通道），不要假装查过。',
    '材料参数、光源型号、材料供应商名录分别用 search_materials / search_light_sources / search_material_suppliers。',
  ],
};
