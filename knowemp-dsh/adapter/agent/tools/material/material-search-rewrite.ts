import type { MaterialFilters, MaterialSearchQuery } from '../../../domain/material';

const KEYWORD_NOISE =
  /饰圈|推荐|几个|型号|材料库|材料|有哪些|帮我|一下|告诉|什么|设计要求/g;

export function materialSearchHasHits(result: {
  totals?: number;
  list?: unknown[];
}): boolean {
  if (typeof result.totals === 'number' && result.totals > 0) return true;
  return Array.isArray(result.list) && result.list.length > 0;
}

export function colorSearchStem(text: string): string | undefined {
  const raw = text.trim();
  if (!raw) return undefined;
  if (
    !/(黄|白|黑|红|蓝|绿|金|灰|棕|紫|透明|乳白|本色|色)/.test(raw)
  ) {
    return undefined;
  }
  const stem = raw.replace(/色$/, '').trim();
  return stem || raw;
}

export function matchListedColors(user: string, colors: string[]): string[] {
  const stem = colorSearchStem(user);
  if (!stem || stem.length < 1) return [];
  return colors.filter((color) => color.includes(stem));
}

export function rewriteMaterialSearchQuery(
  query: MaterialSearchQuery,
  filters?: Pick<MaterialFilters, 'colors' | 'materialNames' | 'specs'>,
): MaterialSearchQuery {
  const keyword = stripKeywordNoise(query.keyword);
  const colors = filters?.colors ?? [];
  let color = query.color?.trim() || undefined;
  let nextKeyword = keyword;

  const colorHint =
    color || (keyword && colorSearchStem(keyword) ? keyword : undefined);
  if (colorHint && colors.length) {
    const exact = colors.find((item) => item === colorHint);
    const matched = matchListedColors(colorHint, colors);
    if (exact) {
      color = exact;
      if (colorSearchStem(nextKeyword ?? '')) nextKeyword = undefined;
    } else if (matched.length === 1) {
      color = matched[0];
      if (colorSearchStem(nextKeyword ?? '')) nextKeyword = undefined;
    } else if (matched.length > 1) {
      color = undefined;
      nextKeyword = colorSearchStem(colorHint) || nextKeyword;
    } else if (color && !colors.includes(color)) {
      color = undefined;
      nextKeyword = colorSearchStem(colorHint) || nextKeyword;
    }
  } else if (colorSearchStem(keyword ?? '')) {
    nextKeyword = colorSearchStem(keyword ?? '') || nextKeyword;
  }

  return {
    ...query,
    keyword: nextKeyword,
    color,
  };
}

export function relaxMaterialSearchQuery(
  query: MaterialSearchQuery,
): MaterialSearchQuery | undefined {
  if (query.spec?.trim()) {
    return { ...query, spec: undefined };
  }
  if (query.materialName?.trim()) {
    return { ...query, materialName: undefined };
  }
  if (query.color?.trim() && query.keyword?.trim()) {
    return { ...query, color: undefined };
  }
  if (query.color?.trim()) {
    const stem = colorSearchStem(query.color);
    return {
      ...query,
      color: undefined,
      keyword: query.keyword?.trim() || stem,
    };
  }
  return undefined;
}

export function materialSearchKey(query: MaterialSearchQuery): string {
  return [
    query.keyword ?? '',
    query.rawType ?? '',
    query.materialName ?? '',
    query.spec ?? '',
    query.color ?? '',
    String(query.page ?? 1),
    String(query.pageSize ?? ''),
  ].join('|');
}

function stripKeywordNoise(keyword?: string): string | undefined {
  if (!keyword) return undefined;
  const cleaned = keyword
    .replace(KEYWORD_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || undefined;
}
