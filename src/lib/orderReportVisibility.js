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

/**
 * Admin / warehouse / team leader order lists: only orders with invoice report.
 * (`seesAllOrders` kept for call-site compat; ignored — post-account roles always filter.)
 * @returns {string|null}
 */
export function orderListReportWhereSql(userRole, _opts = {}) {
  if (!isPostAccountPipelineRole(userRole)) return null;
  return sqlHasInvoiceReportClause("no");
}

export function passesReportVisibilityGate(order, userRole, { username } = {}) {
  if (hasOrderInvoiceReport(order)) return true;
  if (isSuperAdminRole(userRole)) return true;
  if (isJwtAccountingRole(userRole)) return true;

  // ADMIN / WH / TL must not see pending-invoice / incomplete-report orders
  // (including orders they created).
  if (isPostAccountPipelineRole(userRole)) return false;

  const creator = String(order?.created_by ?? "").trim();
  const viewer = String(username ?? "").trim();
  if (creator && viewer && creator === viewer) return true;

  return true;
}
