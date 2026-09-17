import type { RequestContext } from '../common/types/request-context';

export const MATERIAL_RESOURCE = 'material';
export const MATERIAL_FILES_RESOURCE = 'material-files';
export const MATERIAL_FILE_CHART_RESOURCE = 'material-file-chart';
export const MATERIAL_FILE_APPLY_RESOURCE = 'material-file-apply';
export const MATERIAL_SUPPLIER_RESOURCE = 'material-supplier';
export const MATERIAL_SUPPLIER_FILTERS_RESOURCE = 'material-supplier-filters';
export const MATERIAL_DEFAULT_PAGE_SIZE = 5;
export const MATERIAL_MAX_PAGE_SIZE = 50;
export const MATERIAL_COMPARE_MIN = 2;
export const MATERIAL_COMPARE_MAX = 5;

export interface MaterialFileRef {
  token?: string;
  fileName?: string;
  fileUrl: string;
}

/** 列表侧白名单。不含 price_factor / puid / 内部路径。 */
export interface MaterialListView {
  materialCode: string;
  rawType?: string;
  materialName?: string;
  spec?: string;
  color?: string;
  colorNo?: string;
  supplier?: string;
  origin?: string;
  lightTransmission?: string;
  isVendorL2?: string;
  sampleImages: MaterialFileRef[];
  hasDatasheet: boolean;
  application?: string;
  sourceSystem: string;
}

export interface MaterialFiltersQuery {
  rawType?: string;
  materialName?: string;
  spec?: string;
  color?: string;
  ctx: RequestContext;
}

export interface MaterialFilters {
  rawTypes: string[];
  materialNames: string[];
  specs: string[];
  colors: string[];
}

export interface MaterialSearchQuery {
  keyword?: string;
  rawType?: string;
  materialName?: string;
  spec?: string;
  color?: string;
  page?: number;
  pageSize?: number;
  ctx: RequestContext;
}

export interface MaterialSearchResult {
  resource: typeof MATERIAL_RESOURCE;
  totals: number;
  page: number;
  pageSize: number;
  list: MaterialListView[];
}

export interface MaterialParameterRow {
  name: string;
  group: string;
  subgroup?: string;
  testStandard?: string;
  testCondition?: string;
  unit?: string;
  value: string;
  explanation?: string;
}

export interface MaterialDetailView {
  resource: typeof MATERIAL_RESOURCE;
  summary: MaterialListView | null;
  parameters: MaterialParameterRow[];
}

export interface MaterialCompareColumn {
  materialCode: string;
  materialName?: string;
  spec?: string;
  color?: string;
}

export interface MaterialCompareRow {
  name: string;
  group: string;
  subgroup?: string;
  unit?: string;
  values: Record<string, string>;
}

export interface MaterialCompareQuery {
  materialCodes: string[];
  rawType: string;
  ctx: RequestContext;
}

export interface MaterialCompareResult {
  resource: typeof MATERIAL_RESOURCE;
  rawType?: string;
  columns: MaterialCompareColumn[];
  rows: MaterialCompareRow[];
  error?: string;
  message?: string;
}

export interface MaterialDetailQuery {
  materialCode: string;
  rawType?: string;
  ctx: RequestContext;
}

export type MaterialFileKind = 'datasheet' | 'report' | 'research' | 'simulation' | 'handbook' | 'other';
export type MaterialFileAccess = 'view' | 'download';

export interface MaterialAttachedFile {
  fileId: string;
  category: string;
  name: string;
  fileType?: string;
  kind: MaterialFileKind;
  canView: boolean;
  canDownload: boolean;
  canChart: boolean;
  viewUrl?: string;
  downloadUrl?: string;
}

export interface MaterialFileListQuery {
  materialCode: string;
  ctx: RequestContext;
}

export interface MaterialFileListResult {
  resource: typeof MATERIAL_FILES_RESOURCE;
  materialCode?: string;
  identityPresent: boolean;
  files: MaterialAttachedFile[];
  error?: string;
  message?: string;
}

export interface MaterialFileChartQuery {
  materialCode: string;
  fileId: string;
  ctx: RequestContext;
}

export interface MaterialChartSeries {
  name: string;
  xUnit?: string;
  yUnit?: string;
  pointCount: number;
  points: Array<{ x: number | string; y: number | string }>;
}

export interface MaterialFileChartResult {
  resource: typeof MATERIAL_FILE_CHART_RESOURCE;
  fileName?: string;
  series: MaterialChartSeries[];
  error?: string;
  message?: string;
}

export interface MaterialFileApplyQuery {
  materialCode: string;
  fileId: string;
  access: MaterialFileAccess;
  reason?: string;
  ctx: RequestContext;
}

export interface MaterialFileApplyResult {
  resource: typeof MATERIAL_FILE_APPLY_RESOURCE;
  submitted: boolean;
  fileName?: string;
  access?: MaterialFileAccess;
  error?: string;
  message?: string;
}

/** TDS「材料供应商」页卡片。电话/邮箱仅在 contactPermission=granted 时出现。 */
export interface MaterialSupplierView {
  name: string;
  applicationArea?: string;
  nameZh?: string;
  nameEn?: string;
  website?: string;
  contact?: string;
  contactPhone?: string;
  contactMail?: string;
  logos: MaterialFileRef[];
  intros: MaterialFileRef[];
  sourceSystem: string;
}

export interface MaterialSupplierFiltersQuery {
  ctx: RequestContext;
}

export interface MaterialSupplierFilters {
  applicationAreas: string[];
}

export interface MaterialSupplierSearchQuery {
  applicationArea?: string;
  supplier?: string;
  page?: number;
  pageSize?: number;
  ctx: RequestContext;
}

export interface MaterialSupplierSearchResult {
  resource: typeof MATERIAL_SUPPLIER_RESOURCE;
  totals: number;
  page: number;
  pageSize: number;
  list: MaterialSupplierView[];
  contactPermission: 'granted' | 'denied';
  contactPermissionMessage: string;
}
