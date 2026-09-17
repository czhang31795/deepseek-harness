/** 厂名身份对照（中文/别名 → TDS suppliers 取值），不表示谁优选 */
const LED_BRAND_ENTRIES: Array<{ supplier: string; aliases: string[] }> = [
  { supplier: 'Dominant', aliases: ['统明亮', 'dominant'] },
  { supplier: 'OSRAM', aliases: ['欧司朗', 'osram'] },
  { supplier: 'Seoul', aliases: ['首尔', 'seoul'] },
  { supplier: 'NICHIA', aliases: ['日亚', 'nichia'] },
  { supplier: 'Lumileds', aliases: ['亮锐', 'lumileds'] },
  { supplier: 'Everlight', aliases: ['亿光', 'everlight'] },
  { supplier: 'LITEON', aliases: ['光宝', 'liteon', 'lite-on'] },
  { supplier: '晶能', aliases: ['晶能'] },
  { supplier: '晶科', aliases: ['晶科'] },
  { supplier: '瑞丰', aliases: ['瑞丰'] },
  { supplier: '聚飞', aliases: ['聚飞'] },
];

function normalizeBrandKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

const ALIAS_TO_SUPPLIER = new Map<string, string>();

function rememberAlias(alias: string, supplier: string) {
  const key = normalizeBrandKey(alias);
  if (!key || !supplier.trim()) return;
  ALIAS_TO_SUPPLIER.set(key, supplier.trim());
}

for (const entry of LED_BRAND_ENTRIES) {
  rememberAlias(entry.supplier, entry.supplier);
  for (const alias of entry.aliases) {
    rememberAlias(alias, entry.supplier);
  }
}

/** 从选型文抽取到库内名后写入，供后续 search 把中文厂名转成 suppliers */
export function learnLedBrandAlias(label: string, supplier: string) {
  rememberAlias(label, supplier);
  rememberAlias(supplier, supplier);
}

export function snapshotLedBrandAliases(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, supplier] of ALIAS_TO_SUPPLIER.entries()) {
    out[key] = supplier;
  }
  return out;
}

/** 给模型看的厂名对照（不含「自己映射自己」），不是优先级 */
export function compactLedBrandAliases(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [alias, supplier] of ALIAS_TO_SUPPLIER.entries()) {
    if (alias === normalizeBrandKey(supplier)) continue;
    out[alias] = supplier;
  }
  return out;
}

export function resolveLedBrand(name: string): string {
  const mapped = ALIAS_TO_SUPPLIER.get(normalizeBrandKey(name));
  return mapped ?? name.trim();
}

export function resolveLedBrands(names: string[]): string[] {
  return [...new Set(names.map(resolveLedBrand).filter(Boolean))];
}

/** 整词是厂名时，改走 suppliers 过滤（TDS keyword=统明亮 会 0 命中） */
export function exactLedBrandSupplier(keyword: string): string | undefined {
  const trimmed = keyword.trim();
  if (!trimmed) return undefined;
  return ALIAS_TO_SUPPLIER.get(normalizeBrandKey(trimmed));
}
