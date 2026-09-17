import { Logger } from '../../../nest-shim.ts'
import type { RequestContext } from '../../../common/types/request-context';
import {
  LIGHT_SOURCE_DEFAULT_PAGE_SIZE,
  LIGHT_SOURCE_MAX_PAGE_SIZE,
  type AppliedRecommend,
  type HostRecommendInfo,
  type LightSourceApplicationCase,
  type LightSourceFilters,
  type LightSourceP2pResult,
  type LightSourceSearchQuery,
  type LightSourceSearchResult,
  type LightSourceView,
} from '../../../domain/light-source';
import {
  exactLedBrandSupplier,
  resolveLedBrands,
} from '../../../domain/led-brand';
import type { LightSourcePort } from '../../contracts/light-source.port';
import {
  expandLightColorTargets,
  isKnownLightColor,
  lightColorMatchesQuery,
  normalizeLightColorKeyword,
} from './light-color.util';
import {
  asNumberArray,
  asStringArray,
  collectRecommend,
  findRecommendRecord,
  intersectCaseInsensitive,
  lightSourceText,
  mapApplicationCases,
  mapFilters,
  mapHostRecommendInfo,
  mapRecommendListFallback,
  pushInFilter,
  pushRangeFilter,
  RANGE_FILTER_MAP,
  toFieldColumns,
  toLightSourceView,
  toTdsOrders,
  type TdsFilter,
} from './light-source.mapper';
import { TdsClient } from './tds.client';

interface TdsListData {
  totals?: number;
  list?: Array<Record<string, unknown>>;
  field?: Record<string, unknown>;
  options?: string[];
}

export class TdsLightSourceAdapter implements LightSourcePort {
  readonly systemId = 'tds';
  private readonly logger = new Logger(TdsLightSourceAdapter.name);

    private readonly client: TdsClient
  constructor(
    client: TdsClient
  ) {
    this.client = client
}

  async getFilters(query: {
    includeVendorGuide?: boolean;
    ctx: RequestContext;
  }): Promise<LightSourceFilters> {
    const includeVendorGuide = query.includeVendorGuide !== false;
    const [basic, apply, host, guide] = await Promise.all([
      this.client.post<Record<string, unknown>>(
        '/lightSource',
        { mode: 'get_basic_filter_info' },
        query.ctx,
      ),
      this.client.post<Record<string, unknown>>(
        '/lightSource',
        { mode: 'get_apply_filter_info' },
        query.ctx,
      ),
      this.client.post<Record<string, unknown>>(
        '/lightSource',
        { mode: 'get_host_filter_info' },
        query.ctx,
      ),
      includeVendorGuide
        ? this.client.post<Record<string, unknown>>(
            '/lightSource',
            { mode: 'get_vendor_guide' },
            query.ctx,
          )
        : Promise.resolve(undefined),
    ]);
    return mapFilters({ basic, apply, host, guide });
  }

  async search(
    query: LightSourceSearchQuery,
  ): Promise<LightSourceSearchResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(
      LIGHT_SOURCE_MAX_PAGE_SIZE,
      Math.max(1, Number(query.pageSize) || LIGHT_SOURCE_DEFAULT_PAGE_SIZE),
    );
    const pageToken = (page - 1) * pageSize;
    const rawKeyword = (query.keyword ?? '').trim();
    const brandKeyword = exactLedBrandSupplier(rawKeyword);
    const explicitColors = asStringArray(query.colors);
    const userSuppliers = resolveLedBrands([
      ...asStringArray(query.suppliers),
      ...(brandKeyword ? [brandKeyword] : []),
    ]);
    const keyword = brandKeyword ? '' : rawKeyword;
    const normalizedKeyword = normalizeLightColorKeyword(keyword);
    const colorAliasMode =
      !explicitColors.length &&
      Boolean(normalizedKeyword) &&
      isKnownLightColor(normalizedKeyword);

    let appliedRecommend: AppliedRecommend | undefined;
    const filters: TdsFilter[] = [];

    pushInFilter(filters, 'PRODUCTLIGHTCOLOR', explicitColors);
    pushInFilter(filters, 'ISMASSPRODUCT', asStringArray(query.massProduction));
    pushInFilter(filters, 'LUMINOUSANGLE', asNumberArray(query.luminousAngles));
    pushInFilter(filters, 'PRODUCTMODEL', asStringArray(query.models));
    pushRangeFilter(
      filters,
      RANGE_FILTER_MAP.consumePowerW,
      query.consumePowerW,
    );
    pushRangeFilter(
      filters,
      RANGE_FILTER_MAP.productPowerW,
      query.productPowerW,
    );
    pushRangeFilter(filters, RANGE_FILTER_MAP.fluxMaxLm, query.fluxMaxLm);
    pushRangeFilter(filters, RANGE_FILTER_MAP.fluxMinLm, query.fluxMinLm);
    pushRangeFilter(
      filters,
      RANGE_FILTER_MAP.fluxTypicalLm,
      query.fluxTypicalLm,
    );
    pushRangeFilter(filters, RANGE_FILTER_MAP.lengthMm, query.lengthMm);
    pushRangeFilter(filters, RANGE_FILTER_MAP.widthMm, query.widthMm);
    pushRangeFilter(filters, RANGE_FILTER_MAP.heightMm, query.heightMm);
    pushRangeFilter(filters, RANGE_FILTER_MAP.maxTjC, query.maxTjC);

    if (query.recommendHost?.trim()) {
      appliedRecommend = await this.applyRecommendFilter(
        filters,
        query,
        userSuppliers,
      );
    } else {
      pushInFilter(filters, 'SUPPLIER', userSuppliers);
    }

    const orders = toTdsOrders(query.sort);
    const merged = new Map<string, LightSourceView>();
    let totals = 0;
    let columns = toFieldColumns(undefined);

    const targets = colorAliasMode
      ? expandLightColorTargets(normalizedKeyword)
      : [keyword];

    for (const target of targets) {
      const data = await this.client.post<TdsListData>(
        '/lightSource',
        {
          mode: 'get_light_source_list',
          page_size: colorAliasMode ? Math.max(pageSize, 30) : pageSize,
          page_token: colorAliasMode ? 0 : pageToken,
          target: target || undefined,
          p2p: Boolean(query.includeP2pSiblings),
          filters: filters.length ? filters : undefined,
          orders,
        },
        query.ctx,
      );
      totals = Number(data.totals ?? totals);
      if (!columns.length) columns = toFieldColumns(data.field);
      for (const row of data.list ?? []) {
        const view = toLightSourceView(row, this.systemId, data.field ?? columns);
        if (!view.itemId || merged.has(view.itemId)) continue;
        if (
          colorAliasMode &&
          !lightColorMatchesQuery(
            normalizedKeyword,
            lightSourceText(view, 'PRODUCTLIGHTCOLOR', 'lightColor'),
          )
        ) {
          continue;
        }
        merged.set(view.itemId, view);
      }
    }

    const list = [...merged.values()].slice(0, pageSize);
    return {
      totals: colorAliasMode ? merged.size : totals,
      page,
      pageSize,
      columns,
      list,
      appliedRecommend,
    };
  }

  async getP2p(query: {
    pinToPin: string;
    lightColor?: string;
    ctx: RequestContext;
  }): Promise<LightSourceP2pResult> {
    const pinToPin = query.pinToPin.trim();
    if (!pinToPin) {
      return { columns: [], list: [], colors: [] };
    }
    try {
      const data = await this.client.post<TdsListData>(
        '/lightSource',
        {
          mode: 'get_light_source_p2p_list',
          p2p: pinToPin,
          PRODUCTLIGHTCOLOR: query.lightColor || undefined,
        },
        query.ctx,
      );
      return {
        columns: toFieldColumns(data.field),
        list: (data.list ?? []).map((row) =>
          toLightSourceView(row, this.systemId, data.field),
        ),
        colors: asStringArray(data.options),
      };
    } catch (error) {
      this.logger.warn(`getP2p failed: ${(error as Error).message}`);
      return { columns: [], list: [], colors: [] };
    }
  }

  async getApplicationCases(query: {
    model: string;
    ctx: RequestContext;
  }): Promise<{ list: LightSourceApplicationCase[] }> {
    const model = query.model.trim();
    if (!model) return { list: [] };
    const data = await this.client.post<{
      list?: Array<Record<string, unknown>>;
    }>(
      '/lightSource',
      { mode: 'get_application_case_by_code', target: model },
      query.ctx,
    );
    return { list: mapApplicationCases(data.list) };
  }

  async getHostRecommendInfo(query: {
    host?: string;
    ctx: RequestContext;
  }): Promise<HostRecommendInfo> {
    try {
      const data = await this.client.post<Record<string, unknown>>(
        '/lightSourceRecommend',
        { mode: 'get_host_recommend_info' },
        query.ctx,
      );
      const mapped = mapHostRecommendInfo(data, query.host);
      if (mapped.list.length || !query.host) return mapped;
    } catch (error) {
      this.logger.warn(
        `get_host_recommend_info failed: ${(error as Error).message}`,
      );
    }

    const fallback = await this.client.post<TdsListData>(
      '/lightSourceRecommend',
      {
        mode: 'get_light_source_recommend_list',
        page_size: 1000,
        page_token: 0,
      },
      query.ctx,
    );
    return mapRecommendListFallback(fallback.list, query.host);
  }

  private async applyRecommendFilter(
    filters: TdsFilter[],
    query: LightSourceSearchQuery,
    userSuppliers: string[],
  ): Promise<AppliedRecommend | undefined> {
    const host = query.recommendHost?.trim() ?? '';
    const info = await this.getHostRecommendInfo({ host, ctx: query.ctx });
    const record = findRecommendRecord(info.list, host);
    if (!record) {
      filters.push(['PRODUCTMODEL', 'in', []]);
      return {
        host,
        lampType: query.lampType ?? null,
        market: query.market ?? null,
        brands: [],
        extraModels: [],
      };
    }

    const collected = collectRecommend(record, query.lampType, query.market);
    let brands = collected.brands;
    let extraModels = collected.extraModels;
    if (userSuppliers.length) {
      brands = intersectCaseInsensitive(brands, userSuppliers);
      extraModels = recordExtraModelsForBrands(
        record,
        query.lampType,
        query.market,
        userSuppliers,
      );
    }

    if (brands.length && extraModels.length) {
      filters.push([
        '__or_group',
        'or',
        [
          ['SUPPLIER', 'in', brands],
          ['PRODUCTMODEL', 'in', extraModels],
        ],
      ]);
    } else if (brands.length) {
      pushInFilter(filters, 'SUPPLIER', brands);
    } else if (extraModels.length) {
      pushInFilter(filters, 'PRODUCTMODEL', extraModels);
    } else {
      filters.push(['PRODUCTMODEL', 'in', []]);
    }

    return {
      host: record.host,
      lampType: query.lampType ?? null,
      market: query.market ?? null,
      brands,
      extraModels,
    };
  }
}

function recordExtraModelsForBrands(
  record: Parameters<typeof collectRecommend>[0],
  lampType: LightSourceSearchQuery['lampType'],
  market: LightSourceSearchQuery['market'],
  brands: string[],
): string[] {
  const wanted = new Set(brands.map((item) => item.trim().toLowerCase()));
  const types = lampType ? [lampType] : (['hl', 'sl'] as const);
  const markets = market ? [market] : (['out', 'in'] as const);
  const models: string[] = [];
  for (const type of types) {
    for (const side of markets) {
      for (const extra of record[type][side].extraModels) {
        if (wanted.has(extra.brand.trim().toLowerCase())) {
          models.push(...extra.models);
        }
      }
    }
  }
  return [...new Set(models)];
}
