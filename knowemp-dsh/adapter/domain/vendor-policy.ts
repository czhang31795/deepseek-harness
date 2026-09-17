export type VendorBrandRank =
  | 'preferred'
  | 'secondary'
  | 'limited'
  | 'caution'
  | 'backup'
  | 'other';

export interface VendorPolicyBrand {
  label: string;
  supplier: string | null;
  rank: VendorBrandRank;
  rankLabel: string;
  note?: string;
}

export interface VendorPolicyConstraint {
  type: 'power' | 'origin' | 'document' | 'region' | 'other';
  summary: string;
  consumePowerW?: { min?: number; max?: number };
  origin?: 'import' | 'domestic' | 'either';
  documents?: string[];
  regions?: string[];
}

export interface VendorPolicyScenario {
  id: string;
  group?: string;
  title: string;
  brands: VendorPolicyBrand[];
  /** 无法量化的原文，回答时必须遵守并说明，不要改写成分数 */
  rules: string[];
  /** 用户还没提供、执行前必须追问的信息 */
  questions: string[];
  /** 能量化、可变成检索/校验条件的约束 */
  constraints: VendorPolicyConstraint[];
}

export const VENDOR_RANK_LABEL: Record<VendorBrandRank, string> = {
  preferred: '优选',
  secondary: '次选',
  limited: '少选',
  caution: '慎选',
  backup: '备选',
  other: '其他',
};

export const VENDOR_POLICY_USAGE =
  '匹配 scenarios[].title。brands.rank 用于检索顺序（preferred → secondary → backup；caution/limited 不当首选）。constraints 仅在用户已提供对应条件时转成 search 参数。questions 里用户未答的必须追问，不要默认满足。rules 是无法量化的原文，回答必须点名遵守，禁止改写成分数或忽略。supplier 为 null 只口头说明。';

export type VendorPolicyExtractedBy = 'llm' | 'rules' | 'none';

export interface VendorSelectionPolicy {
  title: string;
  updateTime: string | null;
  usage: string;
  rankLegend: Record<VendorBrandRank, string>;
  scenarios: VendorPolicyScenario[];
  extractedBy: VendorPolicyExtractedBy;
}

const RANK_MARKERS: Array<{ token: string; rank: VendorBrandRank }> = [
  { token: '优选', rank: 'preferred' },
  { token: '次选', rank: 'secondary' },
  { token: '备选', rank: 'backup' },
];

const NOTE_RANK: Array<{ note: string; rank: VendorBrandRank }> = [
  { note: '慎选', rank: 'caution' },
  { note: '少选', rank: 'limited' },
  { note: '不主动选', rank: 'caution' },
];

export function vendorScenarioId(text: string): string {
  return text
    .replace(/\s+/g, '_')
    .replace(/[^\w\u4e00-\u9fff._-]/g, '')
    .slice(0, 48) || 'scenario';
}

function isRuleToken(text: string): boolean {
  return /TDS|价格|保证函|专利|功率|报告|沟通|谈判|升级|地区|客户/.test(text);
}

function splitBrandTokens(raw: string): string[] {
  return raw
    .split(/[、，,;/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function peelTrailingParen(text: string): { rest: string; inner: string } | null {
  const end = text[text.length - 1];
  if (end !== '）' && end !== ')') return null;
  let depth = 0;
  for (let i = text.length - 1; i >= 0; i -= 1) {
    const ch = text[i];
    if (ch === '）' || ch === ')') depth += 1;
    if (ch === '（' || ch === '(') depth -= 1;
    if (depth === 0) {
      return {
        rest: text.slice(0, i).trim(),
        inner: text.slice(i + 1, -1).trim(),
      };
    }
  }
  return null;
}

function parseBrandToken(
  raw: string,
  fallbackRank: VendorBrandRank,
): VendorPolicyBrand | { rule: string } | null {
  let text = raw.trim().replace(/^[:：]+/, '').replace(/[。；;]+$/, '');
  if (!text) return null;

  const trailingNotes: string[] = [];
  const trailingRules: string[] = [];
  while (true) {
    const peeled = peelTrailingParen(text);
    if (!peeled) break;
    if (NOTE_RANK.some((item) => peeled.inner.includes(item.note))) {
      trailingNotes.push(peeled.inner);
      text = peeled.rest;
      continue;
    }
    if (isRuleToken(peeled.inner) || peeled.inner.length > 12) {
      trailingRules.push(peeled.inner);
      text = peeled.rest;
      continue;
    }
    break;
  }

  if (!text || isRuleToken(text) || /^[（(]/.test(text)) {
    const rule = text || trailingRules[0] || trailingNotes[0];
    return rule ? { rule } : null;
  }

  let rank = fallbackRank;
  let note: string | undefined;
  for (const extra of trailingNotes) {
    note = extra;
    const hit = NOTE_RANK.find((item) => extra.includes(item.note));
    if (hit) rank = hit.rank;
  }

  return { label: text, supplier: null, rank, note, rankLabel: VENDOR_RANK_LABEL[rank] };
}

function parseRankedClause(body: string): {
  brands: VendorPolicyBrand[];
  rules: string[];
} {
  const brands: VendorPolicyBrand[] = [];
  const rules: string[] = [];
  const parts = body.split(/(优选|次选|备选)/);
  let currentRank: VendorBrandRank | null = null;

  for (const part of parts) {
    const marker = RANK_MARKERS.find((item) => item.token === part);
    if (marker) {
      currentRank = marker.rank;
      continue;
    }
    if (!part.trim()) continue;
    if (!currentRank) {
      if (isRuleToken(part)) rules.push(part.trim());
      continue;
    }
    for (const token of splitBrandTokens(part)) {
      const parsed = parseBrandToken(token, currentRank);
      if (!parsed) continue;
      if ('rule' in parsed) {
        rules.push(parsed.rule);
        continue;
      }
      brands.push(parsed);
    }
  }
  return { brands, rules };
}

function parseBullet(line: string, group?: string): VendorPolicyScenario {
  const trimmed = line.replace(/^[-·•]\s*/, '').trim();
  const colon = trimmed.search(/[:：]/);
  const title = colon >= 0 ? trimmed.slice(0, colon).trim() : trimmed.slice(0, 20);
  const body = colon >= 0 ? trimmed.slice(colon + 1).trim() : trimmed;
  const hasRank = /优选|次选|备选/.test(body) || /优选|次选|备选/.test(trimmed);
  const source = hasRank ? (colon >= 0 ? body : trimmed) : '';
  const parsed = hasRank
    ? parseRankedClause(source)
    : { brands: [], rules: body ? [body] : [trimmed] };

  return {
    id: vendorScenarioId(title || group || 'item'),
    group,
    title: title || group || '未命名场景',
    brands: parsed.brands,
    rules: parsed.rules,
    questions: [],
    constraints: [],
  };
}

export function parseVendorGuideText(content: string, groupTitle?: string): VendorPolicyScenario[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const scenarios: VendorPolicyScenario[] = [];
  let group = groupTitle;
  let pendingRules: string[] = [];

  const flushRules = () => {
    if (!pendingRules.length || !scenarios.length) return;
    const last = scenarios[scenarios.length - 1];
    last.rules = [...last.rules, ...pendingRules];
    pendingRules = [];
  };

  for (const line of lines) {
    const heading = line.match(/^\d+\.\s*(.+)$/);
    if (heading) {
      flushRules();
      group = heading[1].replace(/[。；;]+$/, '').trim();
      continue;
    }
    if (/^[ivx]+\.\s*/i.test(line) || /^[（(]?[ivx]+[)）]\s*/i.test(line)) {
      pendingRules.push(line.replace(/^[（(]?[ivx]+[.)）]\s*/i, '').trim());
      continue;
    }
    if (/^[-·•]/.test(line) || /优选|次选|备选/.test(line)) {
      const scenario = parseBullet(line, group);
      if (pendingRules.length) {
        scenario.rules = [...scenario.rules, ...pendingRules];
        pendingRules = [];
      }
      scenarios.push(scenario);
      continue;
    }
    if (isRuleToken(line) && scenarios.length) {
      scenarios[scenarios.length - 1].rules.push(line);
    }
  }

  flushRules();

  return scenarios.filter(
    (item) =>
      item.brands.length > 0 ||
      item.rules.length > 0 ||
      item.questions.length > 0 ||
      item.constraints.length > 0,
  );
}

export function bindVendorPolicyBrands(
  scenarios: VendorPolicyScenario[],
  supplierNames: string[],
  resolve: (label: string) => string,
): VendorPolicyScenario[] {
  const byLower = new Map(
    supplierNames.map((name) => [name.trim().toLowerCase(), name.trim()]),
  );

  const matchSupplier = (label: string, hinted?: string | null): string | null => {
    if (hinted?.trim()) {
      const hintedHit = byLower.get(hinted.trim().toLowerCase());
      if (hintedHit) return hintedHit;
    }
    const resolved = resolve(label);
    const direct = byLower.get(resolved.toLowerCase()) ?? byLower.get(label.trim().toLowerCase());
    if (direct) return direct;
    const fuzzy = supplierNames.filter((name) => {
      const a = name.toLowerCase();
      const b = resolved.toLowerCase();
      return a.includes(b) || b.includes(a);
    });
    return fuzzy.length === 1 ? fuzzy[0] : null;
  };

  return scenarios.map((scenario) => ({
    ...scenario,
    brands: scenario.brands.map((brand) => ({
      ...brand,
      supplier: matchSupplier(brand.label, brand.supplier),
      rankLabel: VENDOR_RANK_LABEL[brand.rank],
    })),
    questions: scenario.questions ?? [],
    constraints: scenario.constraints ?? [],
  }));
}

export function assembleVendorSelectionPolicy(input: {
  title?: string;
  updateTime?: string | null;
  scenarios: VendorPolicyScenario[];
  supplierNames: string[];
  resolve: (label: string) => string;
  extractedBy: VendorPolicyExtractedBy;
}): VendorSelectionPolicy {
  return {
    title: input.title?.trim() || '厂商选型政策',
    updateTime: input.updateTime ?? null,
    usage: VENDOR_POLICY_USAGE,
    rankLegend: { ...VENDOR_RANK_LABEL },
    scenarios: bindVendorPolicyBrands(
      input.scenarios,
      input.supplierNames,
      input.resolve,
    ),
    extractedBy: input.extractedBy,
  };
}

export function emptyVendorSelectionPolicy(
  title = '厂商选型政策',
  updateTime: string | null = null,
): VendorSelectionPolicy {
  return assembleVendorSelectionPolicy({
    title,
    updateTime,
    scenarios: [],
    supplierNames: [],
    resolve: (label) => label,
    extractedBy: 'none',
  });
}

export function buildVendorSelectionPolicy(
  guides: Array<{ title?: string; content?: string; updateTime?: string | null }>,
  supplierNames: string[],
  resolve: (label: string) => string,
): VendorSelectionPolicy {
  const scenarios = guides.flatMap((guide) =>
    parseVendorGuideText(guide.content ?? '', guide.title),
  );
  return assembleVendorSelectionPolicy({
    title: guides[0]?.title?.trim() || '厂商选型政策',
    updateTime: guides[0]?.updateTime ?? null,
    scenarios,
    supplierNames,
    resolve,
    extractedBy: 'rules',
  });
}
