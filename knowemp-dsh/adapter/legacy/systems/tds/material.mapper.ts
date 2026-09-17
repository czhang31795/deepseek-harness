import {
  MATERIAL_RESOURCE,
  type MaterialAttachedFile,
  type MaterialChartSeries,
  type MaterialCompareColumn,
  type MaterialCompareResult,
  type MaterialCompareRow,
  type MaterialDetailView,
  type MaterialFileAccess,
  type MaterialFileKind,
  type MaterialFileRef,
  type MaterialFilters,
  type MaterialListView,
  type MaterialParameterRow,
  type MaterialSupplierFilters,
  type MaterialSupplierView,
} from '../../../domain/material';

export interface MaterialClassifyField {
  field?: string;
  field_name?: string;
  classify_one?: string | null;
  classify_two?: string | null;
  unit?: string | null;
  explan?: string | null;
  test_standard?: string | null;
  test_way?: string | null;
}

export interface MaterialClassifyNode {
  key?: string;
  value?: MaterialClassifyField[] | MaterialClassifyNode[];
  children?: MaterialClassifyNode[];
}

const HREADER_FILE_PREFIX = '/hreaderFile';
const HREADER_INTRANET_ORIGIN = /^https?:\/\/172\.16\.2\.86\/hreader/i;

const SKIP_FIELDS = new Set([
  'img',
  'price_factor',
  'puid',
  'no',
  'owningusername',
  'real_paths',
  'totals',
]);

export function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

export function emptyMaterialSearch(
  page: number,
  pageSize: number,
): {
  resource: typeof MATERIAL_RESOURCE;
  totals: number;
  page: number;
  pageSize: number;
  list: MaterialListView[];
} {
  return {
    resource: MATERIAL_RESOURCE,
    totals: 0,
    page,
    pageSize,
    list: [],
  };
}

export function mapMaterialFilters(data: Record<string, unknown>): MaterialFilters {
  const list =
    data.list && typeof data.list === 'object' && !Array.isArray(data.list)
      ? (data.list as Record<string, unknown>)
      : {};
  return {
    rawTypes: asStringArray(list.pxy2_rawtype),
    materialNames: asStringArray(list.pobject_name),
    specs: asStringArray(list.pxy2_spec),
    colors: asStringArray(list.pxy2_color),
  };
}

export function toMaterialListView(
  row: Record<string, unknown>,
  sourceSystem: string,
  origin: string,
): MaterialListView | null {
  const materialCode = asString(row.pxy2_matrialcode);
  if (!materialCode) return null;
  return {
    materialCode,
    rawType: asString(row.pxy2_rawtype),
    materialName: asString(row.pobject_name),
    spec: asString(row.pxy2_spec),
    color: asString(row.pxy2_color),
    colorNo: asString(row.pxy2_stringtype1),
    supplier: asString(row.pxy2_supplier),
    origin: asString(row.pxy2_placeofproduction),
    lightTransmission: asString(row.pxy2_lighttransmission),
    isVendorL2: asString(row.pxy2_isvendorl2rawmaterial),
    sampleImages: mapHreaderFileRefs(row.img, origin),
    hasDatasheet: hasDatasheet(row.real_paths),
    application: asString(row.application),
    sourceSystem,
  };
}

export function mapMaterialDetail(
  row: Record<string, unknown> | undefined,
  classify: unknown,
  sourceSystem: string,
  origin: string,
): MaterialDetailView {
  const summary = row ? toMaterialListView(row, sourceSystem, origin) : null;
  const defs = flattenClassify(classify);
  const parameters: MaterialParameterRow[] = [];
  if (row) {
    for (const def of defs) {
      if (def.group === '基本信息') continue;
      const raw = formatCell(row[def.field]);
      if (!raw) continue;
      parameters.push({
        name: def.name,
        group: def.group,
        subgroup: def.subgroup,
        testStandard: def.testStandard,
        testCondition: def.testCondition,
        unit: def.unit,
        value: raw,
        explanation: def.explanation,
      });
    }
  }
  return {
    resource: MATERIAL_RESOURCE,
    summary,
    parameters,
  };
}

export function mapMaterialCompare(
  rows: Array<Record<string, unknown>>,
  classify: unknown,
  rawType: string,
  sourceSystem: string,
  origin: string,
): MaterialCompareResult {
  const views = rows
    .map((row) => toMaterialListView(row, sourceSystem, origin))
    .filter((item): item is MaterialListView => Boolean(item));
  const columns: MaterialCompareColumn[] = views.map((item) => ({
    materialCode: item.materialCode,
    materialName: item.materialName,
    spec: item.spec,
    color: item.color,
  }));
  const byCode = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const code = asString(row.pxy2_matrialcode);
    if (code) byCode.set(code, row);
  }
  const compareRows: MaterialCompareRow[] = [];
  for (const def of flattenClassify(classify)) {
    const values: Record<string, string> = {};
    let anyValue = false;
    for (const column of columns) {
      const row = byCode.get(column.materialCode);
      const text = row ? formatCell(row[def.field]) : '';
      values[column.materialCode] = text || '-';
      if (text) anyValue = true;
    }
    if (!anyValue) continue;
    compareRows.push({
      name: def.name,
      group: def.group,
      subgroup: def.subgroup,
      unit: def.unit,
      values,
    });
  }
  return {
    resource: MATERIAL_RESOURCE,
    rawType,
    columns,
    rows: compareRows,
  };
}

export function extractClassifyTree(data: unknown): unknown {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data !== 'object') return [];
  const rec = data as Record<string, unknown>;
  if (Array.isArray(rec.value)) return rec.value;
  if (Array.isArray(rec.fields)) return rec.fields;
  if (rec.fields && typeof rec.fields === 'object') {
    return extractClassifyTree(rec.fields);
  }
  return [];
}

interface ClassifyDef {
  field: string;
  name: string;
  group: string;
  subgroup?: string;
  unit?: string;
  testStandard?: string;
  testCondition?: string;
  explanation?: string;
}

function flattenClassify(raw: unknown): ClassifyDef[] {
  const tree = extractClassifyTree(raw);
  if (!Array.isArray(tree)) return [];
  const out: ClassifyDef[] = [];
  const walk = (nodes: unknown[], fallbackGroup: string) => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const rec = node as MaterialClassifyNode;
      const group = asString(rec.key) ?? fallbackGroup;
      const value = Array.isArray(rec.value) ? rec.value : [];
      const children = Array.isArray(rec.children) ? rec.children : [];
      for (const item of value) {
        if (!item || typeof item !== 'object') continue;
        const fieldRec = item as MaterialClassifyField;
        const field = asString(fieldRec.field);
        if (!field || SKIP_FIELDS.has(field)) continue;
        out.push({
          field,
          name: asString(fieldRec.field_name) ?? field,
          group: asString(fieldRec.classify_two) ?? group,
          subgroup: asString(fieldRec.classify_two)
            ? asString(fieldRec.classify_one)
            : undefined,
          unit: asString(fieldRec.unit),
          testStandard: asString(fieldRec.test_standard),
          testCondition: asString(fieldRec.test_way),
          explanation: asString(fieldRec.explan),
        });
      }
      if (children.length) walk(children, group);
    }
  };
  walk(tree, '参数');
  return out;
}

export function mapMaterialSupplierFilters(
  data: Record<string, unknown>,
): MaterialSupplierFilters {
  const list =
    data.list && typeof data.list === 'object' && !Array.isArray(data.list)
      ? (data.list as Record<string, unknown>)
      : {};
  return {
    applicationAreas: asStringArray(list.application_area),
  };
}

export function toMaterialSupplierView(
  row: Record<string, unknown>,
  sourceSystem: string,
  origin: string,
  options: { includeContact?: boolean } = {},
): MaterialSupplierView | null {
  const name = asString(row.supplier);
  if (!name) return null;
  const view: MaterialSupplierView = {
    name,
    applicationArea: asString(row.application_area),
    nameZh: asString(row.supplier_chn),
    nameEn: asString(row.supplier_eng),
    website: toWebsiteUrl(asString(row.supplier_website)),
    contact: asString(row.contact),
    logos: mapHreaderFileRefs(row.supplier_logo, origin),
    intros: mapHreaderFileRefs(row.supplier_intro, origin),
    sourceSystem,
  };
  if (options.includeContact) {
    view.contactPhone = asString(row.contact_phone);
    view.contactMail = asString(row.contact_mail);
  }
  return view;
}

export function mapHreaderFileRefs(raw: unknown, origin: string): MaterialFileRef[] {
  if (!Array.isArray(raw)) return [];
  const files: MaterialFileRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const fileUrl = toHreaderFileUrl(
      asString(rec.file_url) ?? asString(rec.fileUrl),
      origin,
    );
    if (!fileUrl) continue;
    files.push({
      token: asString(rec.token),
      fileName: asString(rec.file_name) ?? asString(rec.fileName),
      fileUrl,
    });
  }
  return files;
}

function toWebsiteUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/^(javascript|data|vbscript):/i.test(url)) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}([/?#].*)?$/i.test(url)) {
    return `https://${url}`;
  }
  return undefined;
}

function hasDatasheet(raw: unknown): boolean {
  if (Array.isArray(raw)) {
    return raw.some((item) => Boolean(asString(item)));
  }
  return Boolean(asString(raw));
}

function formatCell(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return undefined;
  }
  const text = String(value).trim();
  return text || undefined;
}

export function toAbsoluteUrl(
  url: string | undefined,
  origin: string,
): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${origin.replace(/\/$/, '')}${url}`;
  return url;
}

/** TDS 样板图走 Nginx `/hreaderFile`，再拼 file_url 相对路径。 */
export function toHreaderFileUrl(
  url: string | undefined,
  origin: string,
): string | undefined {
  if (!url) return undefined;
  const host = origin.replace(/\/$/, '');
  if (HREADER_INTRANET_ORIGIN.test(url)) {
    const rest = url.replace(HREADER_INTRANET_ORIGIN, '');
    return `${host}${HREADER_FILE_PREFIX}${rest.startsWith('/') ? rest : `/${rest}`}`;
  }
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  if (
    path === HREADER_FILE_PREFIX ||
    path.startsWith(`${HREADER_FILE_PREFIX}/`)
  ) {
    return `${host}${path}`;
  }
  return `${host}${HREADER_FILE_PREFIX}${path}`;
}

export function hasPriceFactor(view: object): boolean {
  return Object.prototype.hasOwnProperty.call(view, 'price_factor')
    || Object.prototype.hasOwnProperty.call(view, 'priceFactor');
}

/** 给模型看的抽样上限，避免红外谱图把上下文撑爆。 */
export const MATERIAL_CHART_LLM_POINT_LIMIT = 80;
/** 前端折线图点数上限；超过则均匀抽稀。 */
export const MATERIAL_CHART_UI_POINT_LIMIT = 4000;
/** @deprecated 使用 MATERIAL_CHART_LLM_POINT_LIMIT */
export const MATERIAL_CHART_POINT_LIMIT = MATERIAL_CHART_LLM_POINT_LIMIT;

export interface MappedMaterialFile {
  view: MaterialAttachedFile;
  onlyId?: string;
  fileNo?: number;
}

export function mapMaterialAttachedFiles(
  groups: unknown,
  origin: string,
): MappedMaterialFile[] {
  if (!Array.isArray(groups)) return [];
  const out: MappedMaterialFile[] = [];
  for (const group of groups) {
    if (!group || typeof group !== 'object') continue;
    const rec = group as Record<string, unknown>;
    const category = asString(rec.relation_type) ?? '附件';
    const files = Array.isArray(rec.file) ? rec.file : [];
    for (const raw of files) {
      if (!raw || typeof raw !== 'object') continue;
      const file = raw as Record<string, unknown>;
      const name = asString(file.dataset_name) ?? '未命名文件';
      const fileType = asString(file.file_type);
      const onlyId = asString(file.only_id);
      const fileNo = asFiniteInt(file.no);
      const fileId = onlyId || (fileNo != null ? `no:${fileNo}` : '');
      if (!fileId) continue;
      const canView = Boolean(file.view_permission);
      const canDownload = Boolean(file.real_permission);
      const kind = classifyMaterialFile(name, category);
      const view: MaterialAttachedFile = {
        fileId,
        category,
        name,
        fileType,
        kind,
        canView,
        canDownload,
        canChart: canView && isExcelType(fileType),
      };
      if (canView) {
        const viewUrl = toAbsoluteUrl(
          asString(file.view_path) ?? asString(file.real_path),
          origin,
        );
        if (viewUrl) view.viewUrl = viewUrl;
      }
      if (canDownload) {
        const downloadUrl = toAbsoluteUrl(asString(file.real_path), origin);
        if (downloadUrl) view.downloadUrl = downloadUrl;
      }
      out.push({ view, onlyId, fileNo: fileNo ?? undefined });
    }
  }
  return out;
}

export function findMappedMaterialFile(
  files: MappedMaterialFile[],
  fileId: string,
): MappedMaterialFile | undefined {
  const parsed = parseListedFileId(fileId);
  return files.find((item) => {
    if (parsed.onlyId && (item.onlyId === parsed.onlyId || item.view.fileId === parsed.onlyId)) {
      return true;
    }
    if (parsed.fileNo != null && item.fileNo === parsed.fileNo) return true;
    return item.view.fileId === fileId.trim();
  });
}

export function extractMaterialPuid(
  row: Record<string, unknown> | undefined,
): string | undefined {
  return row ? asString(row.puid) : undefined;
}

export function buildMaterialFileApplyParam(input: {
  unionId: string;
  onlyId: string;
  access: MaterialFileAccess;
  reason?: string;
}): Record<string, unknown> {
  const isDownload = input.access === 'download';
  return {
    file_id: input.onlyId,
    apply_user: input.unionId,
    permission_field: isDownload ? 'real_path' : 'view_path',
    remark: isDownload ? '下载权限' : '查看权限',
    apply_result:
      input.reason?.trim()
      || (isDownload ? '申请下载材料文件' : '申请查看材料文件'),
  };
}

export function downsamplePoints<T>(points: T[], limit: number): T[] {
  if (limit <= 0 || points.length <= limit) return points;
  if (limit === 1) return [points[0]];
  const last = points.length - 1;
  const out: T[] = [];
  let prev = -1;
  for (let i = 0; i < limit; i += 1) {
    const idx = Math.round((i * last) / (limit - 1));
    if (idx === prev) continue;
    out.push(points[idx]);
    prev = idx;
  }
  return out;
}

function numericRange(
  points: Array<{ x: number | string; y: number | string }>,
  key: 'x' | 'y',
): [number, number] | undefined {
  const nums = points
    .map((point) => Number(point[key]))
    .filter((value) => Number.isFinite(value));
  if (!nums.length) return undefined;
  return [Math.min(...nums), Math.max(...nums)];
}

export function mapMaterialChart(
  data: unknown,
  fileName?: string,
): { fileName?: string; series: MaterialChartSeries[] } {
  const rec =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const payload =
    rec.list && typeof rec.list === 'object'
      ? (rec.list as Record<string, unknown>)
      : rec;
  const tag =
    payload.tag && typeof payload.tag === 'object'
      ? (payload.tag as Record<string, Record<string, unknown>>)
      : {};
  const points = Array.isArray(payload.data) ? payload.data : [];
  const grouped = new Map<string, Array<{ x: number | string; y: number | string }>>();
  for (const point of points) {
    if (!point || typeof point !== 'object') continue;
    const row = point as Record<string, unknown>;
    const type = asString(row.type) ?? 'line0';
    const x = row.x as number | string;
    const y = row.y as number | string;
    if (x == null || y == null) continue;
    const list = grouped.get(type) ?? [];
    list.push({ x, y });
    grouped.set(type, list);
  }
  const series: MaterialChartSeries[] = [...grouped.entries()].map(([type, pts]) => {
    const meta = tag[type] ?? {};
    return {
      name: asString(meta.y_name) ?? type,
      xUnit: asString(meta.x_unit),
      yUnit: asString(meta.y_unit),
      pointCount: pts.length,
      points: downsamplePoints(pts, MATERIAL_CHART_UI_POINT_LIMIT),
    };
  });
  return {
    fileName: asString(rec.file) ?? fileName,
    series,
  };
}

/** 给模型的曲线结果：均匀抽样 + 数值范围，前端仍用完整 series。 */
export function compactMaterialChartForLlm(result: unknown): unknown {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return result;
  }
  const rec = result as Record<string, unknown>;
  if (rec.resource !== 'material-file-chart' || !Array.isArray(rec.series)) {
    return result;
  }
  return {
    ...rec,
    series: rec.series.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const series = item as MaterialChartSeries;
      const points = Array.isArray(series.points) ? series.points : [];
      const sampled = downsamplePoints(points, MATERIAL_CHART_LLM_POINT_LIMIT);
      return {
        name: series.name,
        xUnit: series.xUnit,
        yUnit: series.yUnit,
        pointCount: series.pointCount,
        sampled: points.length > sampled.length,
        xRange: numericRange(points, 'x'),
        yRange: numericRange(points, 'y'),
        points: sampled,
      };
    }),
  };
}

export function parseListedFileId(fileId: string): {
  onlyId?: string;
  fileNo?: number;
} {
  const text = fileId.trim();
  if (text.startsWith('no:')) {
    const fileNo = Number(text.slice(3));
    return Number.isFinite(fileNo) ? { fileNo } : {};
  }
  return { onlyId: text };
}

function classifyMaterialFile(name: string, category: string): MaterialFileKind {
  if (name.includes('物性表')) return 'datasheet';
  if (category.includes('研究')) return 'research';
  if (category.includes('仿真')) return 'simulation';
  if (category.includes('手册')) return 'handbook';
  if (category.includes('报告')) return 'report';
  return 'other';
}

function isExcelType(fileType?: string): boolean {
  return Boolean(fileType && /xlsx|xls/i.test(fileType));
}

function asFiniteInt(value: unknown): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}
