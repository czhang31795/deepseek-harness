import { createHash } from 'crypto';
import {
  assembleVendorSelectionPolicy,
  emptyVendorSelectionPolicy,
  type VendorSelectionPolicy,
} from './vendor-policy';
import {
  countPolicyBrands,
  extractionTitle,
  parseJsonObject,
  scenariosFromLlmExtraction,
} from './vendor-policy-json';

type Guide = { title?: string; content?: string; updateTime?: string | null };

export function vendorPolicyCacheKey(
  guides: Guide[],
  supplierNames: string[],
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        guides: guides.map((item) => ({
          title: item.title ?? '',
          updateTime: item.updateTime ?? null,
          content: item.content ?? '',
        })),
        suppliers: supplierNames,
      }),
    )
    .digest('hex');
}

export class VendorPolicyCache {
  private readonly items = new Map<string, VendorSelectionPolicy>();

  get(key: string): VendorSelectionPolicy | undefined {
    const hit = this.items.get(key);
    if (!hit) return undefined;
    this.remember(key, hit);
    return hit;
  }

  set(key: string, policy: VendorSelectionPolicy) {
    this.remember(key, policy);
    while (this.items.size > 32) {
      const oldest = this.items.keys().next().value;
      if (!oldest) break;
      this.items.delete(oldest);
    }
  }

  private remember(key: string, policy: VendorSelectionPolicy) {
    this.items.delete(key);
    this.items.set(key, policy);
  }
}

export function llmPayloadFromChat(result: {
  content?: string | null;
  toolCalls?: Array<{ function: { name: string; arguments: string } }>;
}): unknown {
  const toolArgs = result.toolCalls?.find(
    (item) => item.function.name === 'submit_vendor_policy',
  )?.function.arguments;
  if (toolArgs?.trim()) return parseJsonObject(toolArgs);
  if (result.content?.trim()) return parseJsonObject(result.content);
  throw new Error('模型未返回 submit_vendor_policy 参数');
}

export function policyFromLlmPayload(
  extracted: unknown,
  guides: Guide[],
  supplierNames: string[],
  resolve: (label: string) => string,
): VendorSelectionPolicy | null {
  const scenarios = scenariosFromLlmExtraction(extracted);
  if (
    countPolicyBrands(scenarios) === 0 &&
    !scenarios.some(
      (item) =>
        item.rules.length > 0 ||
        item.questions.length > 0 ||
        item.constraints.length > 0,
    )
  ) {
    return null;
  }
  return assembleVendorSelectionPolicy({
    title: extractionTitle(extracted, guides[0]?.title?.trim() || '厂商选型政策'),
    updateTime: guides[0]?.updateTime ?? null,
    scenarios,
    supplierNames,
    resolve,
    extractedBy: 'llm',
  });
}

export function policyIfNoGuide(guides: Guide[]): VendorSelectionPolicy | null {
  if (guides.some((item) => item.content?.trim())) return null;
  return emptyVendorSelectionPolicy(
    guides[0]?.title?.trim() || '厂商选型政策',
    guides[0]?.updateTime ?? null,
  );
}
