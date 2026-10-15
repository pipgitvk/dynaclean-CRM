import { normalizeRoleKey, isJwtAccountingRole } from "@/lib/roleKeyUtils";
import { hasOrderInvoiceReport } from "@/lib/orderDocumentEditRules";
import { isSuperAdminRole } from "@/lib/dataScope";

/** Admin / warehouse / team leader — pipeline after accountant report. */
export function isPostAccountPipelineRole(userRole) {
  const k = normalizeRoleKey(userRole);
  return (
    k === "ADMIN" ||
    k === "WAREHOUSE INCHARGE" ||
    k === "TEAM LEADER"
  );
}

export function sqlHasInvoiceReportClause(tableAlias = "no") {
  const col = `${tableAlias}.report_file`;
  return `(TRIM(COALESCE(${col}, '')) != '' AND TRIM(COALESCE(${col}, '')) != '0')`;
}

/** @returns {string|null} */
export function orderListReportWhereSql(userRole, { seesAllOrders = false } = {}) {
  if (!seesAllOrders) return null;
  if (!isPostAccountPipelineRole(userRole)) return null;
  return sqlHasInvoiceReportClause("no");
}

export function passesReportVisibilityGate(order, userRole, { username } = {}) {
  if (hasOrderInvoiceReport(order)) return true;
  if (isSuperAdminRole(userRole)) return true;
  if (isJwtAccountingRole(userRole)) return true;

  const creator = String(order?.created_by ?? "").trim();
  const viewer = String(username ?? "").trim();
  if (creator && viewer && creator === viewer) return true;

  if (isPostAccountPipelineRole(userRole)) return false;

  return true;
}
