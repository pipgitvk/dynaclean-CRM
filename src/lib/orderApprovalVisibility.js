/** Order list / detail visibility until SUPERADMIN/DIRECTOR approves on admin order flow. */

import { passesReportVisibilityGate } from "@/lib/orderReportVisibility";

export function normalizeOrderApprovalStatus(status) {
  return String(status ?? "").trim().toLowerCase();
}

/** Listed in normal order tables (approved, rejected by admin, or legacy empty). */
export function isOrderApprovedForListing(approvalStatus) {
  const s = normalizeOrderApprovalStatus(approvalStatus);
  if (s === "approved") return true;
  if (s === "rejected") return true;
  if (s === "") return true;
  return false;
}

export function canViewUnapprovedOrder(userRole) {
  const r = String(userRole ?? "").trim().toUpperCase();
  return r === "SUPERADMIN" || r === "DIRECTOR";
}

/**
 * @param {{ order?: object, username?: string }} [context]
 */
export function isOrderVisibleToViewer(approvalStatus, userRole, context = {}) {
  if (!isOrderApprovedForListing(approvalStatus)) {
    if (!canViewUnapprovedOrder(userRole)) return false;
  }
  const { order, username } = context;
  if (order != null) {
    if (!passesReportVisibilityGate(order, userRole, { username })) {
      return false;
    }
  }
  return true;
}

export function sqlApprovedOrdersOnlyClause(tableAlias = "no") {
  const col = `${tableAlias}.approval_status`;
  return `(LOWER(TRIM(COALESCE(${col}, ''))) = 'approved' OR TRIM(COALESCE(${col}, '')) = '')`;
}

/** Sales / user order lists: approved + admin-rejected (+ legacy empty). Pending stays hidden. */
export function sqlListedOrderApprovalClause(tableAlias = "no") {
  const col = `${tableAlias}.approval_status`;
  return `(LOWER(TRIM(COALESCE(${col}, ''))) IN ('approved', 'rejected') OR TRIM(COALESCE(${col}, '')) = '')`;
}

/**
 * SQL fragment for order list queries. On admin order page, approvers see pending/rejected too.
 * @returns {string|null}
 */
export function orderListApprovalWhereSql(userRole, { adminOrderPage = false } = {}) {
  if (adminOrderPage && canViewUnapprovedOrder(userRole)) return null;
  return sqlListedOrderApprovalClause("no");
}

export function appendSqlWhereClause(sql, condition) {
  if (!condition) return sql;
  if (/\bWHERE\b/i.test(sql)) return `${sql} AND ${condition}`;
  return `${sql} WHERE ${condition}`;
}
