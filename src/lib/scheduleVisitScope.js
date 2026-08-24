import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import { getScopedUsername } from "@/lib/dataScope";

export function isScheduleVisitSuperAdmin(role) {
  return normalizeRoleKey(role) === "SUPERADMIN";
}

/** Schedule Visit on customer profile — Sales, Superadmin, Service dashboards only. */
export function canShowScheduleVisitOnCustomerProfile(role) {
  const k = normalizeRoleKey(role);
  if (k === "SUPERADMIN") return true;
  if (k.includes("SALES")) return true;
  if (k.includes("SERVICE")) return true;
  return false;
}

function buildCustomerOwnershipSql({ role, username }) {
  const u = String(username ?? "").trim();
  if (!u) {
    return { sql: "1=0", params: [] };
  }

  const roleKey = normalizeRoleKey(role);

  if (roleKey === "SERVICE SUPPORT") {
    return { sql: "service_lead_source = ?", params: [u] };
  }

  if (roleKey === "GEM") {
    return { sql: "gem_lead_source = ?", params: [u] };
  }

  return {
    sql: "(lead_source = ? OR sales_representative = ? OR assigned_to = ?)",
    params: [u, u, u],
  };
}

/**
 * Visibility for schedule_visit list/count.
 * SUPERADMIN → all. Others → own customers OR visits created/assigned to self or reportees.
 */
export function buildScheduleVisitVisibilityWhere({ role, username, reportees = [] }) {
  if (isScheduleVisitSuperAdmin(role)) {
    return { whereClause: "", params: [], join: "" };
  }

  const u = String(username ?? "").trim();
  if (!u) {
    return { whereClause: "AND 1=0", params: [], join: "" };
  }

  const visibleUsers = [...new Set([u, ...reportees.filter(Boolean)])];
  const placeholders = visibleUsers.map(() => "?").join(",");
  const ownership = buildCustomerOwnershipSql({ role, username });

  const whereClause = `AND (
    schedule_visit.created_by IN (${placeholders})
    OR schedule_visit.assigned_to IN (${placeholders})
    OR schedule_visit.customer_id IN (
      SELECT customer_id FROM customers WHERE ${ownership.sql}
    )
  )`;

  return {
    whereClause,
    params: [...visibleUsers, ...visibleUsers, ...ownership.params],
    join: "",
  };
}

/**
 * Ownership WHERE fragment on customers table (no alias) — for customer search.
 */
export function buildCustomerOwnershipWhere({ role, username }) {
  if (isScheduleVisitSuperAdmin(role)) {
    return { whereClause: "", params: [] };
  }

  const ownership = buildCustomerOwnershipSql({ role, username });
  if (ownership.sql === "1=0") {
    return { whereClause: "AND 1=0", params: [] };
  }

  return {
    whereClause: `AND ${ownership.sql}`,
    params: ownership.params,
  };
}

export async function userOwnsCustomer(conn, customerId, payload) {
  if (isScheduleVisitSuperAdmin(payload?.role)) return true;

  const username = getScopedUsername(payload);
  const ownership = buildCustomerOwnershipWhere({
    role: payload?.role,
    username,
  });

  const [rows] = await conn.execute(
    `SELECT customer_id FROM customers WHERE customer_id = ? ${ownership.whereClause} LIMIT 1`,
    [customerId, ...ownership.params]
  );

  return rows.length > 0;
}
