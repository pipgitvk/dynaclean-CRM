import { getDbConnection } from "@/lib/db";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";

/** Current userRole from rep_list (source of truth after admin Quick Edit). */
export async function getRepListUserRole(username) {
  const u = String(username || "").trim();
  if (!u) return null;
  try {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      "SELECT userRole FROM rep_list WHERE username = ? LIMIT 1",
      [u],
    );
    const role = rows[0]?.userRole;
    return role ? String(role).trim() : null;
  } catch {
    return null;
  }
}

export function rolesMatch(a, b) {
  return normalizeRoleKey(a) === normalizeRoleKey(b);
}
