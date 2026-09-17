import type { RequestContext } from '../../../common/types/request-context';
import {
  MATERIAL_COMPARE_MAX,
  MATERIAL_COMPARE_MIN,
  MATERIAL_DEFAULT_PAGE_SIZE,
  MATERIAL_FILE_APPLY_RESOURCE,
  MATERIAL_FILE_CHART_RESOURCE,
  MATERIAL_FILES_RESOURCE,
  MATERIAL_MAX_PAGE_SIZE,
  MATERIAL_RESOURCE,
  MATERIAL_SUPPLIER_RESOURCE,
  type MaterialCompareQuery,
  type MaterialCompareResult,
  type MaterialDetailQuery,
  type MaterialDetailView,
  type MaterialFileApplyQuery,
  type MaterialFileApplyResult,
  type MaterialFileChartQuery,
  type MaterialFileChartResult,
  type MaterialFileListQuery,
  type MaterialFileListResult,
  type MaterialFilters,
  type MaterialFiltersQuery,
  type MaterialSearchQuery,
  type MaterialSearchResult,
  type MaterialSupplierFilters,
  type MaterialSupplierFiltersQuery,
  type MaterialSupplierSearchQuery,
  type MaterialSupplierSearchResult,
} from '../../../domain/material';
import type { MaterialPort } from '../../contracts/material.port';
import {
  asString,
  buildMaterialFileApplyParam,
  emptyMaterialSearch,
  extractClassifyTree,
  extractMaterialPuid,
  findMappedMaterialFile,
  mapMaterialChart,
  mapMaterialCompare,
  mapMaterialDetail,
  mapMaterialFilters,
  mapMaterialAttachedFiles,
  mapMaterialSupplierFilters,
  toMaterialListView,
  toMaterialSupplierView,
  type MappedMaterialFile,
} from './material.mapper';
import { TdsClient } from './tds.client';
import {
  canViewSupplierContact,
  supplierContactPermissionMessage,
} from './supplier-contact-permission';

interface TdsMaterialListData {
  totals?: number;
  list?: Array<Record<string, unknown>>;
}

interface TdsMaterialByCodesData {
  list?: Array<Record<string, unknown>>;
  fields?: unknown;
}

export class TdsMaterialAdapter implements MaterialPort {
  readonly systemId = 'tds';

    private readonly client: TdsClient
  constructor(
    client: TdsClient
  ) {
    this.client = client
}

  async getFilters(query: MaterialFiltersQuery): Promise<MaterialFilters> {
    const data = await this.client.post<Record<string, unknown>>(
      '/materialInfo',
      {
        mode: 'get_filter_info',
        pxy2_rawtype: query.rawType ?? '',
        pobject_name: query.materialName ?? '',
        pxy2_spec: query.spec ?? '',
        pxy2_color: query.color ?? '',
      },
      query.ctx,
    );
    return mapMaterialFilters(asObject(data));
  }

  async search(query: MaterialSearchQuery): Promise<MaterialSearchResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(
      MATERIAL_MAX_PAGE_SIZE,
      Math.max(1, Number(query.pageSize) || MATERIAL_DEFAULT_PAGE_SIZE),
    );
    const keyword = (query.keyword ?? '').trim();
    const rawType = (query.rawType ?? '').trim();
    const materialName = (query.materialName ?? '').trim();
    const spec = (query.spec ?? '').trim();
    const color = (query.color ?? '').trim();
    if (!keyword && !rawType && !materialName && !spec && !color) {
      return emptyMaterialSearch(page, pageSize);
    }

    const data = await this.client.post<TdsMaterialListData>(
      '/materialInfo',
      {
        mode: 'get_material_info_list',
        page_size: pageSize,
        page_token: (page - 1) * pageSize,
        pxy2_rawtype: rawType,
        pobject_name: materialName,
        pxy2_spec: spec,
        pxy2_color: color,
        search_value: keyword,
      },
      query.ctx,
    );
    const payload = asObject(data) as TdsMaterialListData;
    const list = (payload.list ?? [])
      .map((row) => toMaterialListView(row, this.systemId, this.client.origin))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    return {
      resource: MATERIAL_RESOURCE,
      totals: Number(payload.totals ?? 0),
      page,
      pageSize,
      list,
    };
  }

  async getDetail(query: MaterialDetailQuery): Promise<MaterialDetailView> {
    const materialCode = query.materialCode.trim();
    const ctx = query.ctx;
    if (!materialCode) {
      return { resource: MATERIAL_RESOURCE, summary: null, parameters: [] };
    }
    let rawType = (query.rawType ?? '').trim();
    if (!rawType) {
      rawType = (await this.resolveRawType(materialCode, ctx)) ?? '';
    }
    if (!rawType) {
      return { resource: MATERIAL_RESOURCE, summary: null, parameters: [] };
    }
    const packed = await this.fetchByCodes([materialCode], rawType, ctx);
    const row = packed.list.find(
      (item) => asString(item.pxy2_matrialcode) === materialCode,
    );
    return mapMaterialDetail(
      row,
      packed.classify,
      this.systemId,
      this.client.origin,
    );
  }

  async compare(query: MaterialCompareQuery): Promise<MaterialCompareResult> {
    const rawType = query.rawType.trim();
    const codes = uniqueCodes(query.materialCodes);
    if (!rawType) {
      return {
        resource: MATERIAL_RESOURCE,
        columns: [],
        rows: [],
        error: 'missing_raw_type',
        message: '对比必须提供材料分类 rawType，取值来自 get_material_filters.rawTypes，不要猜测。',
      };
    }
    if (codes.length < MATERIAL_COMPARE_MIN || codes.length > MATERIAL_COMPARE_MAX) {
      return {
        resource: MATERIAL_RESOURCE,
        rawType,
        columns: [],
        rows: [],
        error: 'invalid_codes',
        message: `对比需要 ${MATERIAL_COMPARE_MIN}～${MATERIAL_COMPARE_MAX} 个物料编码。`,
      };
    }
    const packed = await this.fetchByCodes(codes, rawType, query.ctx);
    return mapMaterialCompare(
      packed.list,
      packed.classify,
      rawType,
      this.systemId,
      this.client.origin,
    );
  }

  async listFiles(query: MaterialFileListQuery): Promise<MaterialFileListResult> {
    const loaded = await this.loadFiles(query.materialCode, query.ctx);
    return loaded.result;
  }

  async analyzeFileChart(
    query: MaterialFileChartQuery,
  ): Promise<MaterialFileChartResult> {
    const loaded = await this.loadFiles(query.materialCode, query.ctx);
    if (loaded.result.error) {
      return {
        resource: MATERIAL_FILE_CHART_RESOURCE,
        series: [],
        error: loaded.result.error,
        message: loaded.result.message,
      };
    }
    const fileId = query.fileId.trim();
    if (!fileId) {
      return {
        resource: MATERIAL_FILE_CHART_RESOURCE,
        series: [],
        error: 'missing_file',
        message: 'fileId 必须来自 list_material_files，不要编造。',
      };
    }
    const hit = findMappedMaterialFile(loaded.mapped, fileId);
    if (!hit) {
      return {
        resource: MATERIAL_FILE_CHART_RESOURCE,
        series: [],
        error: 'file_not_found',
        message: '清单里没有这个文件，请先 list_material_files。',
      };
    }
    if (!hit.view.canView) {
      return {
        resource: MATERIAL_FILE_CHART_RESOURCE,
        fileName: hit.view.name,
        series: [],
        error: 'forbidden',
        message: '当前身份没有查看该文件的权限，可走 apply_material_file_access。',
      };
    }
    if (!hit.view.canChart || hit.fileNo == null) {
      return {
        resource: MATERIAL_FILE_CHART_RESOURCE,
        fileName: hit.view.name,
        series: [],
        error: 'not_excel',
        message: '只有可查看的 Excel 物性表/曲线文件才能取图。',
      };
    }
    try {
      const data = await this.client.post<unknown>(
        '/materialInfo',
        {
          mode: 'analysis_excel_chart',
          param: String(hit.fileNo),
        },
        query.ctx,
      );
      if (typeof data === 'string') {
        return {
          resource: MATERIAL_FILE_CHART_RESOURCE,
          fileName: hit.view.name,
          series: [],
          error: 'chart_failed',
          message: data,
        };
      }
      const mapped = mapMaterialChart(data, hit.view.name);
      return {
        resource: MATERIAL_FILE_CHART_RESOURCE,
        fileName: mapped.fileName,
        series: mapped.series,
      };
    } catch (error) {
      return {
        resource: MATERIAL_FILE_CHART_RESOURCE,
        fileName: hit.view.name,
        series: [],
        error: 'chart_failed',
        message: errorMessage(error),
      };
    }
  }

  async applyFileAccess(
    query: MaterialFileApplyQuery,
  ): Promise<MaterialFileApplyResult> {
    const loaded = await this.loadFiles(query.materialCode, query.ctx);
    if (loaded.result.error) {
      return {
        resource: MATERIAL_FILE_APPLY_RESOURCE,
        submitted: false,
        error: loaded.result.error,
        message: loaded.result.message,
      };
    }
    const fileId = query.fileId.trim();
    const hit = findMappedMaterialFile(loaded.mapped, fileId);
    if (!fileId || !hit) {
      return {
        resource: MATERIAL_FILE_APPLY_RESOURCE,
        submitted: false,
        error: 'file_not_found',
        message: 'fileId 必须来自 list_material_files。',
      };
    }
    const granted =
      query.access === 'download' ? hit.view.canDownload : hit.view.canView;
    if (granted) {
      return {
        resource: MATERIAL_FILE_APPLY_RESOURCE,
        submitted: false,
        fileName: hit.view.name,
        access: query.access,
        error: 'already_granted',
        message: `当前身份已有该文件的${query.access === 'download' ? '下载' : '查看'}权限。`,
      };
    }
    if (!hit.onlyId) {
      return {
        resource: MATERIAL_FILE_APPLY_RESOURCE,
        submitted: false,
        fileName: hit.view.name,
        access: query.access,
        error: 'missing_file_id',
        message: '该文件缺少可申请的标识，无法提交。',
      };
    }
    const unionId = this.client.resolveUnionId(query.ctx);
    if (!unionId) {
      return missingIdentityApply();
    }
    try {
      await this.client.post(
        '/MaterialInfoFileApply',
        {
          mode: 'addApplyFile',
          param: buildMaterialFileApplyParam({
            unionId,
            onlyId: hit.onlyId,
            access: query.access,
            reason: query.reason,
          }),
        },
        query.ctx,
      );
      return {
        resource: MATERIAL_FILE_APPLY_RESOURCE,
        submitted: true,
        fileName: hit.view.name,
        access: query.access,
        message: '已提交权限申请，等待管理员审批。',
      };
    } catch (error) {
      return {
        resource: MATERIAL_FILE_APPLY_RESOURCE,
        submitted: false,
        fileName: hit.view.name,
        access: query.access,
        error: 'apply_failed',
        message: errorMessage(error),
      };
    }
  }

  async getSupplierFilters(
    query: MaterialSupplierFiltersQuery,
  ): Promise<MaterialSupplierFilters> {
    const data = await this.client.post<Record<string, unknown>>(
      '/materialSupplier',
      { mode: 'get_basic_filter_info' },
      query.ctx,
    );
    return mapMaterialSupplierFilters(asObject(data));
  }

  async searchSuppliers(
    query: MaterialSupplierSearchQuery,
  ): Promise<MaterialSupplierSearchResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(
      MATERIAL_MAX_PAGE_SIZE,
      Math.max(1, Number(query.pageSize) || MATERIAL_DEFAULT_PAGE_SIZE),
    );
    const applicationArea = (query.applicationArea ?? '').trim();
    const supplier = (query.supplier ?? '').trim();
    const body: Record<string, unknown> = {
      mode: 'get_material_supplier_list',
      page_size: pageSize,
      page_token: (page - 1) * pageSize,
    };
    if (applicationArea) body.application_area = applicationArea;
    if (supplier) body.supplier = supplier;

    const data = await this.client.post<TdsMaterialListData>(
      '/materialSupplier',
      body,
      query.ctx,
    );
    const payload = asObject(data) as TdsMaterialListData;
    const includeContact = await this.resolveSupplierContactPermission(query.ctx);
    const list = (payload.list ?? [])
      .map((row) =>
        toMaterialSupplierView(row, this.systemId, this.client.origin, {
          includeContact,
        }),
      )
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    return {
      resource: MATERIAL_SUPPLIER_RESOURCE,
      totals: Number(payload.totals ?? 0),
      page,
      pageSize,
      list,
      contactPermission: includeContact ? 'granted' : 'denied',
      contactPermissionMessage: supplierContactPermissionMessage(includeContact),
    };
  }

  private async resolveSupplierContactPermission(
    ctx: RequestContext,
  ): Promise<boolean> {
    const unionId = this.client.resolveUnionId(ctx);
    const pkDept = await this.client.lookupPkDept(unionId);
    return canViewSupplierContact(pkDept);
  }

  private async loadFiles(
    materialCode: string,
    ctx: RequestContext,
  ): Promise<{ result: MaterialFileListResult; mapped: MappedMaterialFile[] }> {
    const code = materialCode.trim();
    if (!code) {
      return {
        mapped: [],
        result: {
          resource: MATERIAL_FILES_RESOURCE,
          identityPresent: Boolean(this.client.resolveUnionId(ctx)),
          files: [],
          error: 'missing_code',
          message: 'materialCode 必须来自 search_materials。',
        },
      };
    }
    const unionId = this.client.resolveUnionId(ctx);
    if (!unionId) {
      return {
        mapped: [],
        result: missingIdentityFiles(code),
      };
    }
    const row = await this.resolveListRow(code, ctx);
    const puid = extractMaterialPuid(row);
    if (!row) {
      return {
        mapped: [],
        result: {
          resource: MATERIAL_FILES_RESOURCE,
          materialCode: code,
          identityPresent: true,
          files: [],
          error: 'not_found',
          message: `没有找到物料 ${code}。`,
        },
      };
    }
    if (!puid) {
      return {
        mapped: [],
        result: {
          resource: MATERIAL_FILES_RESOURCE,
          materialCode: code,
          identityPresent: true,
          files: [],
          error: 'missing_puid',
          message: '该物料没有文件主键，无法列附件。',
        },
      };
    }
    try {
      const data = await this.client.post<unknown>(
        '/materialInfo',
        {
          mode: 'get_material_file',
          puid,
          union_id: unionId,
        },
        ctx,
      );
      const groups = Array.isArray(data)
        ? data
        : (asObject(data).list ?? asObject(data).file ?? []);
      const mapped = mapMaterialAttachedFiles(groups, this.client.origin);
      return {
        mapped,
        result: {
          resource: MATERIAL_FILES_RESOURCE,
          materialCode: code,
          identityPresent: true,
          files: mapped.map((item) => item.view),
        },
      };
    } catch (error) {
      if (isUnknownUserError(error)) {
        return {
          mapped: [],
          result: {
            resource: MATERIAL_FILES_RESOURCE,
            materialCode: code,
            identityPresent: true,
            files: [],
            error: 'unknown_user',
            message: '当前身份不在 TDS 人员表中，无法核验文件权限。',
          },
        };
      }
      return {
        mapped: [],
        result: {
          resource: MATERIAL_FILES_RESOURCE,
          materialCode: code,
          identityPresent: true,
          files: [],
          error: 'list_failed',
          message: errorMessage(error),
        },
      };
    }
  }

  private async resolveListRow(
    materialCode: string,
    ctx: RequestContext,
  ): Promise<Record<string, unknown> | undefined> {
    const data = await this.client.post<TdsMaterialListData>(
      '/materialInfo',
      {
        mode: 'get_material_info_list',
        page_size: 10,
        page_token: 0,
        pxy2_rawtype: '',
        pobject_name: '',
        pxy2_spec: '',
        pxy2_color: '',
        search_value: materialCode,
      },
      ctx,
    );
    const payload = asObject(data) as TdsMaterialListData;
    const list = Array.isArray(payload.list) ? payload.list : [];
    return (
      list.find((item) => asString(item.pxy2_matrialcode) === materialCode)
      ?? list[0]
    );
  }

  private async resolveRawType(
    materialCode: string,
    ctx: RequestContext,
  ): Promise<string | undefined> {
    const found = await this.search({
      keyword: materialCode,
      page: 1,
      pageSize: 10,
      ctx,
    });
    const exact = found.list.find((item) => item.materialCode === materialCode);
    return exact?.rawType ?? found.list[0]?.rawType;
  }

  private async fetchByCodes(
    materialCodes: string[],
    materialType: string,
    ctx: RequestContext,
  ): Promise<{ list: Array<Record<string, unknown>>; classify: unknown }> {
    const data = await this.client.post<TdsMaterialByCodesData | string>(
      '/materialInfo',
      {
        mode: 'get_material_info_by_codes',
        material_codes: materialCodes,
        material_type: materialType,
      },
      ctx,
    );
    const payload = asObject(data) as TdsMaterialByCodesData;
    return {
      list: Array.isArray(payload.list) ? payload.list : [],
      classify: extractClassifyTree(payload),
    };
  }
}

function asObject(data: unknown): Record<string, unknown> {
  if (typeof data === 'string') {
    throw new Error(data);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  return data as Record<string, unknown>;
}

function uniqueCodes(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const code = value.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function missingIdentityFiles(materialCode?: string): MaterialFileListResult {
  return {
    resource: MATERIAL_FILES_RESOURCE,
    materialCode,
    identityPresent: false,
    files: [],
    error: 'missing_identity',
    message:
      '查看材料文件需要当前登录身份。不要编造预览或下载链接。',
  };
}

function missingIdentityApply(): MaterialFileApplyResult {
  return {
    resource: MATERIAL_FILE_APPLY_RESOURCE,
    submitted: false,
    error: 'missing_identity',
    message: '申请文件权限需要当前登录身份。',
  };
}

function isUnknownUserError(error: unknown): boolean {
  const message = errorMessage(error);
  return /unknown_user|人员唯一标识|Cannot read propert|user_info/i.test(
    message,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
