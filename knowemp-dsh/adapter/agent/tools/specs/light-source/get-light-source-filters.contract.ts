import type { ToolContract } from '../../tool.types';

export const GET_LIGHT_SOURCE_FILTERS_CONTRACT: ToolContract = {
  name: 'get_light_source_filters',
  summary:
    '获取 TDS 光学光源库的筛选项、取值范围，以及从侧栏说明抽出的结构化厂商政策 vendorPolicy。问出口/国内推荐厂商或型号时必须先调本工具，按 vendorPolicy.brands[].supplier + rank 去 search，不要凭记忆排序。search.suppliers 只用库内名（见 brandAliases）。不要把自然语言整句当筛选值。',
  upstream: {
    system: 'tds',
    method: 'POST',
    path: '/tds/serve/lightSource',
    mode: 'get_basic_filter_info+get_apply_filter_info+get_host_filter_info+get_vendor_guide',
  },
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      includeVendorGuide: {
        type: 'boolean',
        default: true,
        description: '是否返回侧栏厂商推荐说明并解析为 vendorPolicy，默认 true',
      },
    },
  },
  returns: {
    type: 'object',
    additionalProperties: false,
    required: [
      'vendorPolicy',
      'vendorGuide',
      'brandAliases',
      'colors',
      'ranges',
      'massProduction',
      'luminousAngles',
      'hosts',
      'suppliers',
    ],
    properties: {
      vendorPolicy: {
        type: 'object',
        description:
          '从 vendorGuide 原文抽出的结构化选型政策（TDS 更新后按内容重新抽取并缓存）。推荐厂商/型号必须遵循本次结果，不要用记忆中的厂名排序。',
        additionalProperties: false,
        required: ['title', 'usage', 'rankLegend', 'scenarios'],
        properties: {
          title: { type: 'string' },
          updateTime: { type: ['string', 'null'] },
          extractedBy: {
            type: 'string',
            enum: ['llm', 'rules', 'none'],
            description: '抽取来源。llm=按原文抽取并缓存；rules=句式兜底。回答不要提这个字段。',
          },
          usage: {
            type: 'string',
            description: '如何使用本结构：匹配场景、按 rank 检索、supplier 为 null 不搜',
          },
          rankLegend: {
            type: 'object',
            additionalProperties: true,
            description:
              'rank → 中文：preferred 优选 / secondary 次选 / limited 少选 / caution 慎选 / backup 备选',
          },
          scenarios: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'title', 'brands', 'rules'],
              properties: {
                id: { type: 'string' },
                group: { type: 'string' },
                title: { type: 'string', description: '场景名，如 合资出口项目 / 国内项目' },
                brands: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['label', 'supplier', 'rank', 'rankLabel'],
                    properties: {
                      label: { type: 'string', description: '选型文中的厂名' },
                      supplier: {
                        type: ['string', 'null'],
                        description:
                          'search_light_sources.suppliers 取值；对不上库内名则为 null，不要用 label 去搜',
                      },
                      rank: {
                        type: 'string',
                        enum: [
                          'preferred',
                          'secondary',
                          'limited',
                          'caution',
                          'backup',
                          'other',
                        ],
                      },
                      rankLabel: { type: 'string', description: '优选/次选/少选/慎选/备选' },
                      note: { type: 'string' },
                    },
                  },
                },
                rules: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '无法量化的裁量原文，回答时必须点名遵守，不要改写成分数',
                },
                questions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '用户还没提供时必须追问，不要默认已经满足',
                },
                constraints: {
                  type: 'array',
                  description: '能量化的约束。仅当用户已给出对应条件时，才转成 search 参数',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['type', 'summary'],
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['power', 'origin', 'document', 'region', 'other'],
                      },
                      summary: { type: 'string' },
                      consumePowerW: {
                        type: 'object',
                        properties: { min: { type: 'number' }, max: { type: 'number' } },
                      },
                      origin: {
                        type: 'string',
                        enum: ['import', 'domestic', 'either'],
                      },
                      documents: { type: 'array', items: { type: 'string' } },
                      regions: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      vendorGuide: {
        type: 'array',
        description: '侧栏原文，供核对；执行优先级以 vendorPolicy 为准。',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'content'],
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            updateTime: { type: ['string', 'null'] },
          },
        },
      },
      brandAliases: {
        type: 'object',
        additionalProperties: true,
        description:
          '厂名身份对照（中文/别名 → search.suppliers 库内名），不是优先级。优先级只看 vendorPolicy.rank。',
      },
      colors: {
        type: 'array',
        description: '光色筛选项，按单多色分组。search 时 colors 传 value。',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['singleMultiColor', 'type', 'options'],
          properties: {
            singleMultiColor: {
              type: 'string',
              description: '单多色分类，如 RGB、单色',
            },
            type: {
              type: 'string',
              enum: ['choice', 'select'],
              description: 'choice=扁平列表；select=再按红/白/黄等分组',
            },
            options: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['value'],
                properties: {
                  group: {
                    type: 'string',
                    description: '分组名，如 红/白/黄/蓝绿/其他。type=choice 时可空',
                  },
                  label: { type: 'string', description: '展示名' },
                  value: {
                    type: 'string',
                    description: '传给 search_light_sources.colors 的值，如 red、PC Amber',
                  },
                },
              },
            },
          },
        },
      },
      ranges: {
        type: 'object',
        additionalProperties: false,
        description: '数值筛选项的全局 min/max，供 search 填区间。值为字符串或数字。',
        properties: {
          consumePowerW: { type: 'object', properties: { min: {}, max: {} } },
          productPowerW: { type: 'object', properties: { min: {}, max: {} } },
          fluxMaxLm: { type: 'object', properties: { min: {}, max: {} } },
          fluxMinLm: { type: 'object', properties: { min: {}, max: {} } },
          fluxTypicalLm: { type: 'object', properties: { min: {}, max: {} } },
          lengthMm: { type: 'object', properties: { min: {}, max: {} } },
          widthMm: { type: 'object', properties: { min: {}, max: {} } },
          heightMm: { type: 'object', properties: { min: {}, max: {} } },
          maxTjC: { type: 'object', properties: { min: {}, max: {} } },
        },
      },
      massProduction: {
        type: 'array',
        items: { type: 'string' },
        description: '是否已量产可选值，传给 search_light_sources.massProduction',
      },
      luminousAngles: {
        type: 'array',
        items: { type: 'number' },
        description: '发光角度可选值，传给 search_light_sources.luminousAngles',
      },
      hosts: {
        type: 'array',
        items: { type: 'string' },
        description: '主机厂名单。某主机厂推荐请用 get_host_recommend_info 或 search 的 recommendHost',
      },
      suppliers: {
        type: 'array',
        description: '供应商库内名（进口/国产）。search.suppliers 必须用这里的 name 或 vendorPolicy.brands[].supplier。',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'category'],
          properties: {
            name: {
              type: 'string',
              description: '供应商名，传给 search_light_sources.suppliers',
            },
            category: {
              type: 'string',
              description: '分类，如 进口 / 国产',
            },
          },
        },
      },
    },
  },
  notes: [
    '筛选项来自当前库内数据，不是写死枚举。供应商名必须用本工具返回的 name / vendorPolicy.brands[].supplier。',
    'vendorPolicy 按本次侧栏原文抽取（优先 LLM，失败才用句式规则），按原文+供应商名单缓存；brandAliases 只做中文↔库内名对照，不表示谁优选。',
    '不要用本工具查具体型号列表，查列表请用 search_light_sources，并按匹配场景的 preferred → secondary 传 suppliers。',
  ],
};
