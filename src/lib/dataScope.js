import { normalizeRoleKey } from "@/lib/roleKeyUtils";

export function isSuperAdminRole(role) {
  return normalizeRoleKey(role) === "SUPERADMIN";
}

export function getScopedUsername(payload) {
  const u = String(payload?.username ?? "").trim();
  return u || null;
}

/**
 * Build an ownership WHERE fragment like:
 *   (col1 = ? OR col2 = ?)
 * returning { sql, params }.
 *
 * If role is SUPERADMIN → { sql: "", params: [] }.
 * If username missing  → { sql: "1=0", params: [] } (deny-by-default).
 *
 * @param {{ role: string, username: string|null, columns: string[] }} args
 */
export function buildOwnershipWhere({ role, username, columns }) {
  if (isSuperAdminRole(role)) return { sql: "", params: [] };
  const u = String(username ?? "").trim();
  if (!u) return { sql: "1=0", params: [] };
  const cols = (columns || []).map(String).map((c) => c.trim()).filter(Boolean);
  if (cols.length === 0) return { sql: "1=0", params: [] };
  const sql = `(${cols.map((c) => `${c} = ?`).join(" OR ")})`;
  return { sql, params: cols.map(() => u) };
}

