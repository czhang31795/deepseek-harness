import {
  VENDOR_RANK_LABEL,
  type VendorBrandRank,
  type VendorPolicyBrand,
  type VendorPolicyConstraint,
  type VendorPolicyScenario,
  vendorScenarioId,
} from './vendor-policy';

const KNOWN_RANKS = new Set<VendorBrandRank>([
  'preferred',
  'secondary',
  'limited',
  'caution',
  'backup',
  'other',
]);

export function normalizeVendorRank(raw: unknown): VendorBrandRank {
  if (typeof raw !== 'string' || !raw.trim()) return 'other';
  const text = raw.trim().toLowerCase();
  if (KNOWN_RANKS.has(text as VendorBrandRank)) return text as VendorBrandRank;
  if (/慎选|不建议|不优先|原则上不|避免|不主动|caution/.test(text)) {
    return 'caution';
  }
  if (/少选|limited/.test(text)) return 'limited';
  if (/备选|backup/.test(text)) return 'backup';
  if (/次选|第二|secondary/.test(text)) return 'secondary';
  if (/优选|优先|首选|第一|preferred/.test(text)) return 'preferred';
  return 'other';
}

export function parseJsonObject(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('抽取结果不是 JSON 对象');
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseBrand(value: unknown): VendorPolicyBrand | null {
  const row = asRecord(value);
  if (!row) return null;
  const label = asString(row.label) || asString(row.name);
  if (!label) return null;
  const rank = normalizeVendorRank(row.rank ?? row.rankLabel);
  const supplierRaw = asString(row.supplier);
  const note = asString(row.note) || undefined;
  return {
    label,
    supplier: supplierRaw || null,
    rank,
    rankLabel: VENDOR_RANK_LABEL[rank],
    note,
  };
}

function parseConstraint(value: unknown): VendorPolicyConstraint | null {
  const row = asRecord(value);
  if (!row) {
    const text = asString(value);
    return text ? { type: 'other', summary: text } : null;
  }
  const typeRaw = asString(row.type).toLowerCase();
  const type: VendorPolicyConstraint['type'] =
    typeRaw === 'power' ||
    typeRaw === 'origin' ||
    typeRaw === 'document' ||
    typeRaw === 'region' ||
    typeRaw === 'other'
      ? typeRaw
      : 'other';
  const summary =
    asString(row.summary) || asString(row.text) || asString(row.rule);
  if (!summary && type === 'other') return null;
  const range = asRecord(row.consumePowerW);
  const originRaw = asString(row.origin);
  const origin: VendorPolicyConstraint['origin'] | undefined =
    originRaw === 'import' || originRaw === 'domestic' || originRaw === 'either'
      ? originRaw
      : undefined;
  const documents = (Array.isArray(row.documents) ? row.documents : [])
    .map(asString)
    .filter(Boolean);
  const regions = (Array.isArray(row.regions) ? row.regions : [])
    .map(asString)
    .filter(Boolean);
  const min = range ? Number(range.min) : Number(row.min);
  const max = range ? Number(range.max) : Number(row.max);
  const consumePowerW =
    Number.isFinite(min) || Number.isFinite(max)
      ? {
          ...(Number.isFinite(min) ? { min } : {}),
          ...(Number.isFinite(max) ? { max } : {}),
        }
      : undefined;
  return {
    type,
    summary: summary || type,
    consumePowerW,
    origin,
    documents: documents.length ? documents : undefined,
    regions: regions.length ? regions : undefined,
  };
}

function parseScenario(value: unknown): VendorPolicyScenario | null {
  const row = asRecord(value);
  if (!row) return null;
  const title = asString(row.title) || asString(row.name);
  const group = asString(row.group) || undefined;
  const brands = (Array.isArray(row.brands) ? row.brands : [])
    .map(parseBrand)
    .filter((item): item is VendorPolicyBrand => Boolean(item));
  const rules = (Array.isArray(row.rules) ? row.rules : [])
    .map(asString)
    .filter(Boolean);
  const questions = (Array.isArray(row.questions) ? row.questions : [])
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      const rec = asRecord(item);
      return rec ? asString(rec.prompt) || asString(rec.text) : '';
    })
    .filter(Boolean);
  const constraints = (Array.isArray(row.constraints) ? row.constraints : [])
    .map(parseConstraint)
    .filter((item): item is VendorPolicyConstraint => Boolean(item));
  if (!title && !brands.length && !rules.length && !questions.length && !constraints.length) {
    return null;
  }
  const resolvedTitle = title || group || '未命名场景';
  return {
    id: asString(row.id) || vendorScenarioId(resolvedTitle),
    group,
    title: resolvedTitle,
    brands,
    rules,
    questions,
    constraints,
  };
}

/** 把 LLM 抽出的 JSON 收成场景列表；supplier 稍后由名单校验，不在这里信任 */
export function scenariosFromLlmExtraction(input: unknown): VendorPolicyScenario[] {
  const root = asRecord(input);
  if (!root) return [];
  const nested = asRecord(root.vendorPolicy) ?? asRecord(root.policy);
  const source = nested ?? root;
  const list = Array.isArray(source.scenarios) ? source.scenarios : [];
  return list
    .map(parseScenario)
    .filter((item): item is VendorPolicyScenario => Boolean(item))
    .filter(
      (item) =>
        item.brands.length > 0 ||
        item.rules.length > 0 ||
        item.questions.length > 0 ||
        item.constraints.length > 0,
    );
}

export function extractionTitle(input: unknown, fallback: string): string {
  const root = asRecord(input);
  const nested = asRecord(root?.vendorPolicy) ?? asRecord(root?.policy);
  return asString(nested?.title) || asString(root?.title) || fallback;
}

export function countPolicyBrands(scenarios: VendorPolicyScenario[]): number {
  return scenarios.reduce((sum, item) => sum + item.brands.length, 0);
}
