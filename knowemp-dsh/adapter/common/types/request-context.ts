export interface RequestContext {
  userId?: string;
  tenantId?: string;
  /** 显式指定业务系统；为空时由 LegacyFacade 按能力/租户路由 */
  systemId?: string;
  traceId?: string;
}
