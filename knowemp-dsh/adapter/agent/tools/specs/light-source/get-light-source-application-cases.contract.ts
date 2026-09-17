import type { ToolContract } from '../../tool.types';

export const GET_LIGHT_SOURCE_APPLICATION_CASES_CONTRACT: ToolContract = {
  name: 'get_light_source_application_cases',
  summary:
    '按光源型号查询应用项目实例（落地车型/项目、光通量、实车图）。model 用 search_light_sources 返回的 PRODUCTMODEL 或 APPPROJECTEXAMPLE。',
  upstream: {
    system: 'tds',
    method: 'POST',
    path: '/tds/serve/lightSource',
    mode: 'get_application_case_by_code',
  },
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['model'],
    properties: {
      model: {
        type: 'string',
        description:
          '光源型号。TDS 对 view_application_case.light_source_model 做 like %model%。不要传整句自然语言。',
      },
    },
  },
  returns: {
    type: 'object',
    additionalProperties: false,
    required: ['list'],
    properties: {
      list: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            hostManufacturer: {
              type: ['string', 'null'],
              description: '主机厂 host_manufacturer',
            },
            projectName: { type: 'string', description: '项目名称 project_name' },
            projectCode: {
              type: ['string', 'null'],
              description: '项目编号 project_code',
            },
            lightSourceModel: {
              type: 'string',
              description: '光源型号 light_source_model',
            },
            lightSourceModelCount: {
              description: '数量 light_source_model_count',
            },
            lightSourceFluxDetail: {
              type: 'string',
              description: '光通量明细 light_source_flux_detail',
            },
            totalLuminousFlux: {
              type: 'string',
              description: '总光通量 total_luminous_flux',
            },
            carPics: {
              type: 'array',
              description: '整车图片。TDS 会把 car_pic token 解析成文件。',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['fileUrl'],
                properties: {
                  token: { type: 'string' },
                  fileName: { type: 'string' },
                  fileUrl: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  notes: [
    '上游视图是 SELECT *，Adapter 只返回本契约字段，丢掉未声明列。',
    '无案例时返回 list=[]，不要编造车型项目。',
  ],
};
