import type { ToolContract } from '../../tool.types';

export const ANALYZE_MATERIAL_FILE_CHART_CONTRACT: ToolContract = {
  name: 'analyze_material_file_chart',
  summary:
    '读取已授权查看的材料 Excel 曲线（如物性表/谱图）。必须先 list_material_files 且 canChart=true。',
  upstream: {
    system: 'tds',
    method: 'POST',
    path: '/tds/serve/materialInfo',
    mode: 'analysis_excel_chart',
  },
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['materialCode', 'fileId'],
    properties: {
      materialCode: {
        type: 'string',
        description: '物料编码，来自 search_materials。',
      },
      fileId: {
        type: 'string',
        description: '必须来自 list_material_files，且该文件 canChart=true。不要传文件 no。',
      },
    },
  },
  returns: {
    type: 'object',
    additionalProperties: false,
    required: ['resource', 'series'],
    properties: {
      resource: { type: 'string', enum: ['material-file-chart'] },
      fileName: { type: 'string' },
      series: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'pointCount', 'points'],
          properties: {
            name: { type: 'string' },
            xUnit: { type: 'string' },
            yUnit: { type: 'string' },
            pointCount: { type: 'number' },
            sampled: {
              type: 'boolean',
              description: 'true 表示这是抽样点，完整曲线在界面卡片里',
            },
            xRange: {
              type: 'array',
              items: { type: 'number' },
              description: 'X 最小/最大（数值轴）',
            },
            yRange: {
              type: 'array',
              items: { type: 'number' },
              description: 'Y 最小/最大（数值轴）',
            },
            points: {
              type: 'array',
              description: '给模型的均匀抽样，最多 80 个点。界面折线图用完整曲线。',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['x', 'y'],
                properties: {
                  x: { type: ['number', 'string'] },
                  y: { type: ['number', 'string'] },
                },
              },
            },
          },
        },
      },
      error: {
        type: 'string',
        description:
          'missing_identity / forbidden / not_excel / file_not_found / chart_failed',
      },
      message: { type: 'string' },
    },
  },
  notes: [
    'Adapter 会先按当前身份核验 canView，无权时不会去解析 Excel。',
    '界面会画折线图。正文只简述趋势/峰值，不要把坐标点贴进 Markdown。',
  ],
};
