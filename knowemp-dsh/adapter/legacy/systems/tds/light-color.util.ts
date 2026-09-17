/**
 * TDS `target` 对部分光色词检索不稳定：例如 PRODUCTLIGHTCOLOR=yellow 的料，
 * target=yellow 可能 totals=0，但系列名含 Amber 时 target=amber 能命中。
 * 这里用别名扩大检索，再按光色字段收敛。
 */
const COLOR_ALIASES: Record<string, string[]> = {
  yellow: ['yellow', 'amber'],
  amber: ['amber', 'yellow'],
  黄: ['yellow', 'amber'],
  黄光: ['yellow', 'amber'],
  琥珀: ['amber', 'yellow'],
  blue: ['blue', 'royal blue'],
  green: ['green', 'pc green'],
  white: ['white'],
  red: ['red'],
  orange: ['orange', 'amber'],
};

const COLOR_CN_TO_EN: Record<string, string> = {
  黄: 'yellow',
  黄光: 'yellow',
  琥珀: 'amber',
  红: 'red',
  红光: 'red',
  绿: 'green',
  绿光: 'green',
  蓝: 'blue',
  蓝光: 'blue',
  白: 'white',
  白光: 'white',
  红外: 'ir',
  紫外: 'uv',
};

export function normalizeLightColorKeyword(raw: string): string {
  const text = raw.trim();
  if (!text) return text;
  return COLOR_CN_TO_EN[text] ?? text;
}

export function expandLightColorTargets(keyword: string): string[] {
  const normalized = normalizeLightColorKeyword(keyword);
  const key = normalized.toLowerCase();
  const aliases = COLOR_ALIASES[key] ?? COLOR_ALIASES[normalized];
  if (!aliases?.length) {
    return normalized ? [normalized] : [];
  }
  // 去重并保持顺序
  return [...new Set(aliases.map((item) => item.trim()).filter(Boolean))];
}

export function isKnownLightColor(keyword: string): boolean {
  const normalized = normalizeLightColorKeyword(keyword);
  const key = normalized.toLowerCase();
  return Boolean(COLOR_ALIASES[key] || COLOR_ALIASES[normalized]);
}

/** 结果光色是否属于本次查询的颜色族 */
export function lightColorMatchesQuery(
  queryColor: string,
  actualColor?: string | null,
): boolean {
  if (!actualColor) return false;
  const actual = actualColor.toLowerCase();
  const targets = expandLightColorTargets(queryColor).map((item) =>
    item.toLowerCase(),
  );
  return targets.some((token) => actual.includes(token));
}
