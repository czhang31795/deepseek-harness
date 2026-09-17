import type {
  HostRecommendInfo,
  LampType,
  LightSourceApplicationCase,
  LightSourceColorGroup,
  LightSourceFilters,
  LightSourceSupplierOption,
  LightSourceView,
  MarketType,
  NumberRange,
  RecommendBrandGroup,
  RecommendHostItem,
} from '../../../domain/light-source';

export type TdsFilter = [string, string, unknown];
export type TdsOrder = [string, 'asc' | 'desc'] | [string, 'asc' | 'desc', 'first' | 'last'];

export const SORT_FIELD_MAP: Record<string, string> = {
  seriesName: 'SERIESNAME',
  productModel: 'PRODUCTMODEL',
  recommendLevel: 'recommend_level',
  costFactor: 'price_factor',
  forwardCurrentMa: 'IFMATJ25',
  productPowerW: 'PRODUCTPOWER',
  lightColor: 'PRODUCTLIGHTCOLOR',
  lengthMm: 'LENGTH',
  widthMm: 'WIDTH',
  heightMm: 'HEIGHT',
  luminousMode: 'LuminousMode',
  ledBrand: 'xy2_LEDBrand',
  supplier: 'SUPPLIER',
  consumePowerW: 'POWERTJ25',
  luminousAngle: 'LUMINOUSANGLE',
  fluxTypicalLm: 'LMTJ25CCOMMONLY',
};

export const RANGE_FILTER_MAP: Record<string, string> = {
  consumePowerW: 'POWERTJ25',
  productPowerW: 'PRODUCTPOWER',
  fluxMaxLm: 'LMTJ25CMAX',
  fluxMinLm: 'LMTJ25CMIN',
  fluxTypicalLm: 'LMTJ25CCOMMONLY',
  lengthMm: 'LENGTH',
  widthMm: 'WIDTH',
  heightMm: 'HEIGHT',
  maxTjC: 'MAXTJ',
};

const ALLOWED_FILTER_COLUMNS = new Set([
  'PRODUCTLIGHTCOLOR',
  'SUPPLIER',
  'ISMASSPRODUCT',
  'LUMINOUSANGLE',
  'PRODUCTMODEL',
  'POWERTJ25',
  'PRODUCTPOWER',
  'LMTJ25CMAX',
  'LMTJ25CMIN',
  'LMTJ25CCOMMONLY',
  'LENGTH',
  'WIDTH',
  'HEIGHT',
  'MAXTJ',
  '__or_group',
]);

export function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

export function asRange(value: unknown): NumberRange | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const rec = value as Record<string, unknown>;
  const min = rec.min == null || rec.min === '' ? undefined : Number(rec.min);
  const max = rec.max == null || rec.max === '' ? undefined : Number(rec.max);
  const out: NumberRange = {};
  if (min != null && Number.isFinite(min)) out.min = min;
  if (max != null && Number.isFinite(max)) out.max = max;
  return out.min == null && out.max == null ? undefined : out;
}

export function pushInFilter(filters: TdsFilter[], column: string, values: unknown[]): void {
  if (!ALLOWED_FILTER_COLUMNS.has(column) || values.length === 0) return;
  filters.push([column, 'in', values]);
}

export function pushRangeFilter(filters: TdsFilter[], column: string, range?: NumberRange): void {
  if (!range || !ALLOWED_FILTER_COLUMNS.has(column)) return;
  if (range.min != null && range.max != null) {
    filters.push([column, 'between', [range.min, range.max]]);
    return;
  }
  if (range.min != null) filters.push([column, '>=', range.min]);
  if (range.max != null) filters.push([column, '<=', range.max]);
}

const SORT_TDS_COLUMNS = new Set(Object.values(SORT_FIELD_MAP));

export function toTdsOrders(sort?: {
  field?: string;
  order?: 'asc' | 'desc';
  nulls?: 'first' | 'last';
}): TdsOrder[] | undefined {
  const raw = sort?.field?.trim();
  const field = raw
    ? (SORT_FIELD_MAP[raw] ?? (SORT_TDS_COLUMNS.has(raw) ? raw : undefined))
    : undefined;
  if (!field) return undefined;
  const order = sort?.order === 'asc' ? 'asc' : 'desc';
  if (sort?.nulls === 'first' || sort?.nulls === 'last') {
    return [[field, order, sort.nulls]];
  }
  return [[field, order]];
}

const ROW_SKIP_KEYS = new Set([
  'totals',
  'price_factor',
  'REVPUID',
  'puid',
  'no',
]);

export function toFieldColumns(
  field: unknown,
): Array<{ key: string; title: string }> {
  if (Array.isArray(field)) {
    return field
      .map((item) => {
        if (!item || typeof item !== 'object') return undefined;
        const rec = item as { key?: unknown; title?: unknown };
        const key = String(rec.key ?? '').trim();
        const title = String(rec.title ?? '').trim();
        return key && title ? { key, title } : undefined;
      })
      .filter((item): item is { key: string; title: string } => Boolean(item));
  }
  if (!field || typeof field !== 'object') return [];
  return Object.entries(field as Record<string, unknown>)
    .filter(([key, title]) => Boolean(key.trim()) && title != null && String(title).trim())
    .map(([key, title]) => ({ key, title: String(title).trim() }));
}

export function lightSourceText(
  row: Record<string, unknown> | undefined,
  ...keys: string[]
): string | undefined {
  if (!row) return undefined;
  for (const key of keys) {
    const text = asString(row[key]);
    if (text) return text;
  }
  return undefined;
}

/** 只保留 TDS `field` 字典里的列，避免 SELECT * 把内部字段交给助手。 */
export function toLightSourceView(
  row: Record<string, unknown>,
  sourceSystem: string,
  field?: unknown,
): LightSourceView {
  const p2pMatch =
    row.p2p === 1 || row.p2p === '1'
      ? 1
      : row.p2p === 2 || row.p2p === '2'
        ? 2
        : undefined;
  const view: LightSourceView = {
    itemId: String(row.ITEMID ?? '').trim(),
    sourceSystem,
  };
  if (row.is_p2p === true || row.is_p2p === 1 || row.is_p2p === '1') {
    view.isP2pSibling = true;
  }
  if (p2pMatch) view.p2pMatch = p2pMatch;

  for (const column of toFieldColumns(field)) {
    if (ROW_SKIP_KEYS.has(column.key)) continue;
    if (column.key === 'show_price') {
      const showPrice = asFiniteNumber(row.show_price);
      const priceFactor = asFiniteNumber(row.price_factor);
      view.show_price =
        showPrice ?? (priceFactor != null ? priceFactor / 10000 : null);
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(row, column.key)) {
      view[column.key] = row[column.key];
    }
  }
  return view;
}

export function mapFilters(input: {
  basic: Record<string, unknown>;
  apply: Record<string, unknown>;
  host: Record<string, unknown>;
  guide?: Record<string, unknown>;
}): LightSourceFilters {
  const basicList = (input.basic.list ?? {}) as Record<string, unknown>;
  const applyList = (input.apply.list ?? {}) as Record<string, unknown>;
  const hostList = (input.host.list ?? {}) as Record<string, unknown>;

  return {
    vendorGuide: Array.isArray(input.guide?.list)
      ? (input.guide.list as Array<Record<string, unknown>>).map((item) => ({
          no: asFiniteNumber(item.no),
          title: String(item.title ?? ''),
          content: stripHtml(String(item.content ?? '')),
          sort: asFiniteNumber(item.sort),
          updateTime: nullableString(item.update_time) ?? null,
        }))
      : undefined,
    colors: mapColorGroups(basicList.PRODUCTLIGHTCOLOR),
    ranges: {
      consumePowerW: asMinMax(applyList.POWERTJ25),
      productPowerW: asMinMax(applyList.PRODUCTPOWER),
      fluxMaxLm: asMinMax(applyList.LMTJ25CMAX),
      fluxMinLm: asMinMax(applyList.LMTJ25CMIN),
      fluxTypicalLm: asMinMax(applyList.LMTJ25CCOMMONLY),
      lengthMm: asMinMax(applyList.LENGTH),
      widthMm: asMinMax(applyList.WIDTH),
      heightMm: asMinMax(applyList.HEIGHT),
      maxTjC: asMinMax(applyList.MAXTJ),
    },
    massProduction: asStringArray(applyList.ISMASSPRODUCT),
    luminousAngles: asNumberArray(applyList.LUMINOUSANGLE),
    hosts: asStringArray(hostList.host),
    suppliers: mapSuppliers(hostList.SUPPLIER),
  };
}

export function mapApplicationCases(
  rows: Array<Record<string, unknown>> | undefined,
): LightSourceApplicationCase[] {
  return (rows ?? []).map((row) => ({
    hostManufacturer: nullableString(row.host_manufacturer) ?? null,
    projectName: asString(row.project_name),
    projectCode: nullableString(row.project_code) ?? null,
    lightSourceModel: asString(row.light_source_model),
    lightSourceModelCount: nullish(row.light_source_model_count),
    lightSourceFluxDetail: asString(row.light_source_flux_detail),
    totalLuminousFlux: asString(row.total_luminous_flux),
    carPics: mapCarPics(row.car_pic),
  }));
}

export function mapHostRecommendInfo(
  data: Record<string, unknown>,
  hostFilter?: string,
): HostRecommendInfo {
  const list = (Array.isArray(data.list) ? data.list : []) as Array<Record<string, unknown>>;
  const mapped = list
    .map(mapRecommendHostItem)
    .filter((item): item is RecommendHostItem => Boolean(item.host));
  const filtered = hostFilter ? filterHosts(mapped, hostFilter) : mapped;
  const hosts = (Array.isArray(data.hosts) ? asStringArray(data.hosts) : mapped.map((item) => item.host));
  return {
    hosts: hostFilter ? filtered.map((item) => item.host) : hosts,
    list: filtered,
  };
}

export function mapRecommendListFallback(
  rows: Array<Record<string, unknown>> | undefined,
  hostFilter?: string,
): HostRecommendInfo {
  const mapped = (rows ?? [])
    .map((row) =>
      mapRecommendHostItem({
        no: row.no,
        host_manufacturer: row.host_manufacturer,
        hl: {
          out: buildRecommendSide(row.hl_out_brand, row.hl_out_type),
          in: buildRecommendSide(row.hl_in_brand, row.hl_in_type),
        },
        sl: {
          out: buildRecommendSide(row.sl_out_brand, row.sl_out_type),
          in: buildRecommendSide(row.sl_in_brand, row.sl_in_type),
        },
      }),
    )
    .filter((item) => item.host);
  const filtered = hostFilter ? filterHosts(mapped, hostFilter) : mapped;
  return {
    hosts: filtered.map((item) => item.host),
    list: filtered,
  };
}

export function findRecommendRecord(
  list: RecommendHostItem[],
  host: string,
): RecommendHostItem | null {
  const target = host.trim();
  if (!target) return null;
  return (
    list.find((item) => item.host === target) ??
    list.find((item) => item.host.includes(target) || target.includes(item.host)) ??
    null
  );
}

export function collectRecommend(
  record: RecommendHostItem,
  lampType?: LampType,
  market?: MarketType,
): { brands: string[]; extraModels: string[] } {
  const types: LampType[] = lampType ? [lampType] : ['hl', 'sl'];
  const markets: MarketType[] = market ? [market] : ['out', 'in'];
  const brands: string[] = [];
  const extraModels: string[] = [];
  for (const type of types) {
    for (const side of markets) {
      const group = record[type][side];
      brands.push(...group.brands);
      extraModels.push(...group.extraModels.flatMap((item) => item.models));
    }
  }
  return {
    brands: unique(brands),
    extraModels: unique(extraModels),
  };
}

export function intersectCaseInsensitive(left: string[], right: string[]): string[] {
  const wanted = new Set(right.map((item) => item.trim().toLowerCase()));
  return unique(left.filter((item) => wanted.has(item.trim().toLowerCase())));
}

function mapRecommendHostItem(row: Record<string, unknown>): RecommendHostItem {
  const host = asString(row.host) ?? asString(row.host_manufacturer) ?? '';
  return {
    no: asFiniteNumber(row.no),
    host,
    hl: {
      out: mapBrandGroup(getSide(row.hl, 'out')),
      in: mapBrandGroup(getSide(row.hl, 'in')),
    },
    sl: {
      out: mapBrandGroup(getSide(row.sl, 'out')),
      in: mapBrandGroup(getSide(row.sl, 'in')),
    },
  };
}

function getSide(value: unknown, key: MarketType): unknown {
  if (!value || typeof value !== 'object') return undefined;
  return (value as Record<string, unknown>)[key];
}

function mapBrandGroup(value: unknown): RecommendBrandGroup {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    if (Array.isArray(rec.brands) || Array.isArray(rec.extraModels) || rec.types) {
      return {
        brands: asStringArray(rec.brands),
        extraModels: mapExtraModels(rec.extraModels ?? rec.types),
      };
    }
  }
  return { brands: [], extraModels: [] };
}

function mapExtraModels(value: unknown): RecommendBrandGroup['extraModels'] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const rec = item as Record<string, unknown>;
        const brand = asString(rec.brand);
        const models = asStringArray(rec.models);
        if (!brand || !models.length) return null;
        return { brand, models };
      })
      .filter((item): item is { brand: string; models: string[] } => Boolean(item));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([brand, models]) => ({
        brand: brand.trim(),
        models: asStringArray(models),
      }))
      .filter((item) => item.brand && item.models.length);
  }
  return [];
}

function buildRecommendSide(brandVal: unknown, typeVal: unknown): RecommendBrandGroup {
  const brands = parseRecommendBrands(brandVal);
  const brandSet = new Set(brands.map((item) => item.toLowerCase()));
  const extraModels = mapExtraModels(parseRecommendTypes(typeVal)).filter(
    (item) => !brandSet.has(item.brand.toLowerCase()),
  );
  return { brands, extraModels };
}

function parseRecommendBrands(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return asStringArray(val);
  if (typeof val !== 'string') return [];
  const trimmed = val.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return asStringArray(parsed);
  } catch {
    // not json
  }
  return trimmed.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
}

function parseRecommendTypes(val: unknown): Record<string, string[]> {
  if (!val) return {};
  let obj: unknown = val;
  if (typeof val === 'string') {
    try {
      obj = JSON.parse(val.trim()) as unknown;
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const result: Record<string, string[]> = {};
  for (const [brand, models] of Object.entries(obj as Record<string, unknown>)) {
    const key = brand.trim();
    const list = asStringArray(Array.isArray(models) ? models : models ? [models] : []);
    if (key && list.length) result[key] = list;
  }
  return result;
}

function mapColorGroups(raw: unknown): LightSourceColorGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const singleMultiColor = String(rec.classify ?? rec.singleMultiColor ?? '');
    const type = rec.type === 'select' ? 'select' : 'choice';
    const options = mapColorOptions(rec.multi_choice ?? rec.options, type);
    return { singleMultiColor, type, options };
  });
}

function mapColorOptions(raw: unknown, type: 'choice' | 'select'): LightSourceColorGroup['options'] {
  if (!Array.isArray(raw)) return [];
  if (type === 'choice') {
    return raw
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') {
          const value = String(item);
          return { value, label: value };
        }
        if (item && typeof item === 'object') {
          const rec = item as Record<string, unknown>;
          const value = asString(rec.value) ?? asString(rec.label);
          if (!value) return null;
          return { value, label: asString(rec.label) ?? value };
        }
        return null;
      })
      .filter((item): item is { value: string; label: string } => Boolean(item));
  }
  return raw.flatMap((group) => {
    if (!group || typeof group !== 'object') return [];
    const rec = group as Record<string, unknown>;
    const groupLabel = asString(rec.label) ?? asString(rec.title);
    const nested = rec.options ?? rec.children ?? rec.multi_choice;
    if (!Array.isArray(nested)) return [];
    return nested
      .map((option) => {
        if (typeof option === 'string' || typeof option === 'number') {
          const value = String(option);
          return { group: groupLabel, value, label: value };
        }
        if (option && typeof option === 'object') {
          const opt = option as Record<string, unknown>;
          const value = asString(opt.value) ?? asString(opt.label);
          if (!value) return null;
          return { group: groupLabel, value, label: asString(opt.label) ?? value };
        }
        return null;
      })
      .filter((item) => item != null);
  });
}

function mapSuppliers(raw: unknown): LightSourceSupplierOption[] {
  if (!raw || typeof raw !== 'object') return [];
  const result: LightSourceSupplierOption[] = [];
  for (const [category, items] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const rec = (item ?? {}) as Record<string, unknown>;
      const name = asString(rec.value) ?? asString(rec.label) ?? asString(rec.db_name);
      if (!name) continue;
      result.push({
        name,
        category: asString(rec.classify) ?? category,
        hosts: String(rec.host_manufacturer ?? '')
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
      });
    }
  }
  return result;
}

function mapCarPics(raw: unknown): LightSourceApplicationCase['carPics'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const rec = item as Record<string, unknown>;
      const fileUrl = asString(rec.file_url) ?? asString(rec.fileUrl);
      if (!fileUrl) return null;
      return {
        token: asString(rec.token),
        fileName: asString(rec.file_name) ?? asString(rec.fileName),
        fileUrl,
      };
    })
    .filter((item) => item != null);
}

function asMinMax(value: unknown): { min?: string | number; max?: string | number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const rec = value as Record<string, unknown>;
  return {
    min: rec.min as string | number | undefined,
    max: rec.max as string | number | undefined,
  };
}

function filterHosts(list: RecommendHostItem[], host: string): RecommendHostItem[] {
  const target = host.trim().toLowerCase();
  if (!target) return list;
  const exact = list.filter((item) => item.host.toLowerCase() === target);
  if (exact.length) return exact;
  return list.filter(
    (item) => item.host.toLowerCase().includes(target) || target.includes(item.host.toLowerCase()),
  );
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function asFiniteNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function nullableString(value: unknown): string | null | undefined {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function nullish(value: unknown): string | number | null {
  if (value == null || value === '') return null;
  return value as string | number;
}
