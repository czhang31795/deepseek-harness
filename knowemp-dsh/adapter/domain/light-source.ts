import type { RequestContext } from '../common/types/request-context';

export type LampType = 'hl' | 'sl';
export type MarketType = 'out' | 'in';

export interface NumberRange {
  min?: number;
  max?: number;
}

export interface LightSourceColumn {
  key: string;
  title: string;
}

/** 行数据跟 TDS `field` 字典走，key 即上游列名（如 PRODUCTMODEL）。 */
export interface LightSourceView {
  itemId: string;
  sourceSystem: string;
  isP2pSibling?: boolean;
  p2pMatch?: 1 | 2;
  [column: string]: unknown;
}

export const LIGHT_SOURCE_DEFAULT_PAGE_SIZE = 5;
export const LIGHT_SOURCE_MAX_PAGE_SIZE = 50;

export interface LightSourceSearchQuery {
  keyword?: string;
  colors?: string[];
  suppliers?: string[];
  massProduction?: string[];
  luminousAngles?: number[];
  models?: string[];
  consumePowerW?: NumberRange;
  productPowerW?: NumberRange;
  fluxMaxLm?: NumberRange;
  fluxMinLm?: NumberRange;
  fluxTypicalLm?: NumberRange;
  lengthMm?: NumberRange;
  widthMm?: NumberRange;
  heightMm?: NumberRange;
  maxTjC?: NumberRange;
  recommendHost?: string;
  lampType?: LampType;
  market?: MarketType;
  sort?: {
    field?: string;
    order?: 'asc' | 'desc';
    nulls?: 'first' | 'last';
  };
  page?: number;
  pageSize?: number;
  includeP2pSiblings?: boolean;
  ctx: RequestContext;
}

export interface AppliedRecommend {
  host: string;
  lampType: LampType | null;
  market: MarketType | null;
  brands: string[];
  extraModels: string[];
}

export interface LightSourceSearchResult {
  totals: number;
  page: number;
  pageSize: number;
  columns: LightSourceColumn[];
  list: LightSourceView[];
  appliedRecommend?: AppliedRecommend;
}

export interface LightSourceColorOption {
  group?: string;
  label?: string;
  value: string;
}

export interface LightSourceColorGroup {
  singleMultiColor: string;
  type: 'choice' | 'select';
  options: LightSourceColorOption[];
}

export interface LightSourceSupplierOption {
  name: string;
  category: string;
  hosts: string[];
}

export interface LightSourceVendorGuide {
  no?: number;
  title: string;
  content: string;
  sort?: number;
  updateTime?: string | null;
}

export interface LightSourceFilters {
  colors: LightSourceColorGroup[];
  ranges: Record<string, { min?: string | number; max?: string | number }>;
  massProduction: string[];
  luminousAngles: number[];
  hosts: string[];
  suppliers: LightSourceSupplierOption[];
  vendorGuide?: LightSourceVendorGuide[];
}

export interface LightSourceP2pResult {
  columns: LightSourceColumn[];
  list: LightSourceView[];
  colors: string[];
}

export interface LightSourceCarPic {
  token?: string;
  fileName?: string;
  fileUrl: string;
}

export interface LightSourceApplicationCase {
  hostManufacturer?: string | null;
  projectName?: string;
  projectCode?: string | null;
  lightSourceModel?: string;
  lightSourceModelCount?: number | string | null;
  lightSourceFluxDetail?: string;
  totalLuminousFlux?: string;
  carPics: LightSourceCarPic[];
}

export interface RecommendExtraModel {
  brand: string;
  models: string[];
}

export interface RecommendBrandGroup {
  brands: string[];
  extraModels: RecommendExtraModel[];
}

export interface RecommendHostItem {
  no?: number;
  host: string;
  hl: { out: RecommendBrandGroup; in: RecommendBrandGroup };
  sl: { out: RecommendBrandGroup; in: RecommendBrandGroup };
}

export interface HostRecommendInfo {
  hosts: string[];
  list: RecommendHostItem[];
}
