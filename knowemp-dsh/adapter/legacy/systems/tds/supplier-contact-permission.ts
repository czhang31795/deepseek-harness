/**
 * 与 TDS 前端材料供应商页一致：电话/邮箱按部门白名单展示。
 * 名单来自 tds/vue/src/stores/main.ts 的 LENS_VIEW。
 */
export const SUPPLIER_CONTACT_ALLOWED_DEPTS = [
  '技术中心技术管理部材料室',
  '星宇研究院前瞻造型与移动美学创意设计室',
  '采购部',
  '采购部直接采购业务室',
  '采购部间接采购业务室',
  '采购部采购管理室',
  '采购部供应商质量管理室',
] as const;

export function canViewSupplierContact(pkDept?: string | null): boolean {
  const dept = String(pkDept ?? '').trim();
  return Boolean(dept) && (SUPPLIER_CONTACT_ALLOWED_DEPTS as readonly string[]).includes(dept);
}

export function supplierContactPermissionMessage(granted: boolean): string {
  return granted
    ? '当前身份有权限查看供应商电话和邮箱。仅当用户明确询问时告知具体号码，不要主动散播。'
    : '当前身份没有权限查看供应商电话和邮箱。用户问起时必须明确说明「没有权限查看」，不要编造号码，也不要说成「工具不返回该字段」。';
}
