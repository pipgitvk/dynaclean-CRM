/**
 * Builds WHERE clause + params for listing prospects.
 * Admins see all rows; sales roles only see rows they created (created_by = username).
 */
export function buildProspectsListWhereClause({ customerIds, like, role, username }) {
  const r = String(role ?? "").toUpperCase().trim();
  const isAdmin = r === "SUPERADMIN" || r === "ADMIN";
  const parts = [];
  const params = [];

  if (customerIds.length > 0) {
    const ph = customerIds.map(() => "?").join(",");
    parts.push(`customer_id IN (${ph})`);
    params.push(...customerIds);
  } else if (like) {
    parts.push(
      `(customer_id LIKE ? OR model LIKE ? OR CAST(qty AS CHAR) LIKE ? OR CAST(amount AS CHAR) LIKE ? OR COALESCE(notes,'') LIKE ?)`,
    );
    params.push(like, like, like, like, like);
  }

  if (!isAdmin) {
    const u = String(username ?? "").trim();
    if (!u) {
      parts.push("1=0");
    } else {
      parts.push("created_by = ?");
      params.push(u);
    }
  }

  const whereSql = parts.length > 0 ? ` WHERE ${parts.join(" AND ")}` : "";
  return { whereSql, params };
}
