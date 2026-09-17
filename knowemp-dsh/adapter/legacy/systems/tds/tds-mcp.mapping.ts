const TOOL_BY_ROUTE: Record<string, string> = {
  '/lightSource:get_basic_filter_info': 'tds_get_basic_filter_info',
  '/lightSource:get_apply_filter_info': 'tds_get_apply_filter_info',
  '/lightSource:get_host_filter_info': 'tds_get_host_filter_info',
  '/lightSource:get_vendor_guide': 'tds_get_vendor_guide',
  '/lightSource:get_light_source_list': 'tds_get_light_source_list',
  '/lightSource:get_light_source_p2p_list': 'tds_get_light_source_p2p_list',
  '/lightSource:get_application_case_by_code': 'tds_get_application_case_by_code',
  '/lightSourceRecommend:get_host_recommend_info': 'tds_get_host_recommend_info',
  '/lightSourceRecommend:get_light_source_recommend_list':
    'tds_get_light_source_recommend_list',
  '/materialInfo:get_filter_info': 'tds_get_filter_info',
  '/materialInfo:get_material_info_list': 'tds_get_material_info_list',
  '/materialInfo:get_material_info_by_codes': 'tds_get_material_info_by_codes',
  '/materialInfo:get_material_file': 'tds_get_material_file',
  '/materialInfo:analysis_excel_chart': 'tds_analysis_excel_chart',
  '/materialInfoClassify:get_material_info_classify_list':
    'tds_get_material_info_classify_list',
  '/MaterialInfoFileApply:addApplyFile': 'tds_add_apply_file',
  '/materialSupplier:get_basic_filter_info':
    'tds_get_material_supplier_filter_info',
  '/materialSupplier:get_material_supplier_list':
    'tds_get_material_supplier_list',
};

export function normalizeTdsPath(path: string): string {
  const text = path.trim();
  return text.startsWith('/') ? text : `/${text}`;
}

export function tdsMcpToolName(path: string, mode: string): string {
  const key = `${normalizeTdsPath(path)}:${mode}`;
  const name = TOOL_BY_ROUTE[key];
  if (!name) {
    throw new Error(`TDS MCP 未覆盖 ${key}，请补工具或改回 HTTP`);
  }
  return name;
}

/** 转成 MCP tool arguments：去掉 mode / union_id，申请接口改成 file_id+access。 */
export function tdsMcpArguments(
  path: string,
  mode: string,
  body: Record<string, unknown>,
): Record<string, unknown> {
  if (mode === 'addApplyFile' || normalizeTdsPath(path) === '/MaterialInfoFileApply') {
    const param =
      body.param && typeof body.param === 'object' && !Array.isArray(body.param)
        ? (body.param as Record<string, unknown>)
        : {};
    const args: Record<string, unknown> = {
      file_id: String(param.file_id ?? ''),
      access: param.permission_field === 'real_path' ? 'download' : 'view',
    };
    const reason = String(param.apply_result ?? '').trim();
    if (reason) args.reason = reason;
    return args;
  }

  const args: Record<string, unknown> = { ...body };
  delete args.mode;
  delete args.union_id;
  delete args.actor_union_id;
  delete args.apply_user;
  if (mode === 'get_material_file') {
    return omitUndefined({ puid: args.puid });
  }
  return omitUndefined(args);
}

export function unwrapTdsServePayload<T>(payload: unknown, source: string): T {
  if (payload == null || typeof payload !== 'object') {
    throw new Error(`${source} 返回空结果`);
  }
  const json = payload as {
    code?: number;
    msg?: string;
    message?: string;
    data?: T;
  };
  if (typeof json.code === 'number' && json.code !== 200) {
    const detail =
      (typeof json.data === 'string' && json.data.trim())
      || json.msg
      || json.message
      || 'unknown';
    throw new Error(`TDS business error ${json.code}: ${detail}`);
  }
  if (Object.prototype.hasOwnProperty.call(json, 'data')) {
    return json.data as T;
  }
  return json as T;
}

function omitUndefined(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}
