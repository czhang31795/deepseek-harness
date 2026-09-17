import { Logger } from '../nest-shim.ts'
import { resolveLedBrand } from '../domain/led-brand';
import type { LightSourceFilters } from '../domain/light-source';
import { buildVendorSelectionPolicy, type VendorSelectionPolicy } from '../domain/vendor-policy';
import {
  llmPayloadFromChat,
  policyFromLlmPayload,
  policyIfNoGuide,
  VendorPolicyCache,
  vendorPolicyCacheKey,
} from '../domain/vendor-policy-extract';
import { LlmService } from '../llm/llm.service';
import type { OpenAiToolDefinition } from './tools/tool.types';

const EXTRACT_TOOL_NAME = 'submit_vendor_policy';

const EXTRACT_SYSTEM = `你是选型政策抽取器。只根据用户提供的侧栏原文抽取结构，不要用记忆中的厂商排序。

必须调用 ${EXTRACT_TOOL_NAME}，不要用自然语言回答。
规则：
- 不要发明原文没有的厂商或场景
- brands.label 用原文厂名，不要自行改成英文
- brands.rank 只能是 preferred / secondary / limited / caution / backup / other
  · 优选、优先、首选、第一推荐 → preferred
  · 次选、第二推荐 → secondary
  · 少选 → limited
  · 慎选、不建议、原则上不用、避免 → caution
  · 备选 → backup
- brands.supplier 只能从用户给出的供应商名单里选；对不上就填 null，禁止编造
- 把原文拆成三类，不要把同一句重复塞进三类：
  · constraints：能量化的条件（功率阈值、进口/国产、保证函/报告、出口地区名单）
  · questions：执行前若用户没说就必须追问的信息（合资还是内资、出口地区、客户是否同意）
  · rules：量化不了的裁量原文（打合风险、价格优势例外等），保持原意，不要改成分数
- 场景 title 用原文小标题（合资出口项目、内资出口项目、国内项目等）`;

const SUBMIT_VENDOR_POLICY_TOOL: OpenAiToolDefinition = {
  type: 'function',
  function: {
    name: EXTRACT_TOOL_NAME,
    description: '提交从选型说明中抽出的结构化厂商政策',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['scenarios'],
      properties: {
        title: { type: 'string' },
        scenarios: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'brands', 'rules', 'questions', 'constraints'],
            properties: {
              group: { type: 'string' },
              title: { type: 'string' },
              brands: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['label', 'rank'],
                  properties: {
                    label: { type: 'string' },
                    supplier: { type: ['string', 'null'] },
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
                    note: { type: 'string' },
                  },
                },
              },
              rules: {
                type: 'array',
                items: { type: 'string' },
                description: '无法量化的裁量原文，执行时必须说明',
              },
              questions: {
                type: 'array',
                items: { type: 'string' },
                description: '用户未提供时必须追问的问题',
              },
              constraints: {
                type: 'array',
                description: '可变成检索/校验条件的量化约束',
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
                      additionalProperties: false,
                      properties: {
                        min: { type: 'number' },
                        max: { type: 'number' },
                      },
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
  },
};

export class VendorPolicyExtractor {
  private readonly logger = new Logger(VendorPolicyExtractor.name);
  private readonly cache = new VendorPolicyCache();

    private readonly llm: LlmService
  constructor(
    llm: LlmService
  ) {
    this.llm = llm
}

  async extract(filters: LightSourceFilters): Promise<VendorSelectionPolicy> {
    const guides = filters.vendorGuide ?? [];
    const supplierNames = filters.suppliers.map((item) => item.name);
    const empty = policyIfNoGuide(guides);
    if (empty) return empty;

    const cacheKey = vendorPolicyCacheKey(guides, supplierNames);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    let lastError = '未抽出场景';
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const result = await this.llm.chat(
          [
            { role: 'system', content: EXTRACT_SYSTEM },
            {
              role: 'user',
              content: JSON.stringify(
                {
                  guides: guides.map((item) => ({
                    title: item.title ?? '',
                    updateTime: item.updateTime ?? null,
                    content: item.content ?? '',
                  })),
                  suppliers: supplierNames,
                },
                null,
                2,
              ),
            },
          ],
          {
            temperature: 0,
            maxTokens: 4096,
            thinking: 'disabled',
            tools: [SUBMIT_VENDOR_POLICY_TOOL],
            toolChoice: {
              type: 'function',
              function: { name: EXTRACT_TOOL_NAME },
            },
          },
        );

        const policy = policyFromLlmPayload(
          llmPayloadFromChat(result),
          guides,
          supplierNames,
          resolveLedBrand,
        );
        if (policy) {
          this.cache.set(cacheKey, policy);
          this.logger.log(
            `vendorPolicy extractedBy=llm scenarios=${policy.scenarios.length}`,
          );
          return policy;
        }
        lastError = '未抽出场景';
        this.logger.warn(
          `vendorPolicy LLM 未抽出场景${attempt < 2 ? '，重试一次' : ''}`,
        );
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `vendorPolicy LLM 抽取失败${attempt < 2 ? '，重试一次' : ''}: ${lastError}`,
        );
      }
    }
    this.logger.warn(`vendorPolicy LLM 抽取放弃，回退规则解析: ${lastError}`);

    return buildVendorSelectionPolicy(guides, supplierNames, resolveLedBrand);
  }
}
