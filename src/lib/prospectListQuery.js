/**
 * Optional admin-only filters (commitment calendar + creator). Ignored when `isAdmin` is false.
 * @typedef {{ commitmentYear?: number|null, commitmentMonth?: number|null, commitmentDay?: number|null, createdBy?: string|null, adminSearch?: string|null }} AdminProspectFilters
 */

/**
 * Builds WHERE clause + params for listing prospects.
 * Admins see all rows; sales roles only see rows they created (created_by = username).
 * @param {{ customerIds: string[], like: string|null, searchRaw?: string|null, role: string, username: string, adminFilters?: AdminProspectFilters|null }} args
 */
export function buildProspectsListWhereClause({
  customerIds,
  like,
  searchRaw = null,
  role,
  username,
  adminFilters = null,
}) {
  const r = String(role ?? "").toUpperCase().trim();
  const isAdmin = r === "SUPERADMIN" || r === "ADMIN";
  const parts = [];
  const params = [];

  if (customerIds.length > 0) {
    const ph = customerIds.map(() => "?").join(",");
    parts.push(`p.customer_id IN (${ph})`);
    params.push(...customerIds);
  } else if (like) {
    const raw = String(searchRaw ?? "").trim();
    const numericCustomer =
      raw.length > 0 && /^\d{1,20}$/.test(raw) ? raw : null;
    if (numericCustomer) {
      parts.push(
        `(TRIM(CAST(p.customer_id AS CHAR)) = ? OR p.model LIKE ? OR CAST(p.qty AS CHAR) LIKE ? OR CAST(p.amount AS CHAR) LIKE ? OR COALESCE(p.notes,'') LIKE ? OR p.customer_id IN (SELECT customer_id FROM quotations_records WHERE quote_number LIKE ?) OR COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), NULLIF(TRIM(c.company), '')) LIKE ?)`,
      );
      params.push(numericCustomer, like, like, like, like, like, like);
    } else {
      parts.push(
        `(p.customer_id LIKE ? OR p.model LIKE ? OR CAST(p.qty AS CHAR) LIKE ? OR CAST(p.amount AS CHAR) LIKE ? OR COALESCE(p.notes,'') LIKE ? OR p.customer_id IN (SELECT customer_id FROM quotations_records WHERE quote_number LIKE ?) OR COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), NULLIF(TRIM(c.company), '')) LIKE ?)`,
      );
      params.push(like, like, like, like, like, like, like);
    }
  }

  if (!isAdmin) {
    const u = String(username ?? "").trim();
    if (!u) {
      parts.push("1=0");
    } else {
      parts.push("p.created_by = ?");
      params.push(u);
    }
  } else if (adminFilters && isAdmin) {
    const y = adminFilters.commitmentYear;
    if (y != null && Number.isFinite(Number(y))) {
      const yn = Number(y);
      if (yn >= 2000 && yn <= 2100) {
        parts.push(`YEAR(p.commitment_date) = ?`);
        params.push(yn);
      }
    }
    const mo = adminFilters.commitmentMonth;
    if (mo != null && Number.isFinite(Number(mo))) {
      const mn = Number(mo);
      if (mn >= 1 && mn <= 12) {
        parts.push(`MONTH(p.commitment_date) = ?`);
        params.push(mn);
      }
    }
    const d = adminFilters.commitmentDay;
    if (d != null && Number.isFinite(Number(d))) {
      const dn = Number(d);
      if (dn >= 1 && dn <= 31) {
        parts.push(`DAY(p.commitment_date) = ?`);
        params.push(dn);
      }
    }
    const cb = String(adminFilters.createdBy ?? "").trim();
    if (cb) {
      parts.push(`p.created_by = ?`);
      params.push(cb.slice(0, 128));
    }
    const as = String(adminFilters.adminSearch ?? "").trim().slice(0, 200);
    if (as) {
      const lp = `%${as}%`;
      parts.push(
        `(CAST(p.customer_id AS CHAR) LIKE ? OR COALESCE(TRIM(p.quote_number), '') LIKE ? OR COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), NULLIF(TRIM(c.company), '')) LIKE ?)`,
      );
      params.push(lp, lp, lp);
    }
  }

  const whereSql = parts.length > 0 ? ` WHERE ${parts.join(" AND ")}` : "";
  return { whereSql, params };
}
