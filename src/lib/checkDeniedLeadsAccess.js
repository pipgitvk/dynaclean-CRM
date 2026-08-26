import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import {
  resolveModuleAccess,
  applySuperadminOnlyModuleRestrictions,
  applyRoleDenyModuleRestrictions,
} from "@/lib/moduleAccess";

export async function checkDeniedLeadsAccess() {
  const payload = await getSessionPayload();
  if (!payload) {
    return { allowed: false, username: null, userRole: null };
  }

  const username = payload.username;
  const userRole = payload.role;
  const roleKey = normalizeRoleKey(userRole) || "GUEST";

  if (roleKey === "SUPERADMIN") {
    return { allowed: true, username, userRole, roleKey };
  }

  try {
    const connection = await getDbConnection();
    const [rows] = await connection.execute(
      "SELECT module_access, userRole FROM rep_list WHERE username = ? LIMIT 1",
      [username]
    );

    let allowedModules = null;
    if (rows.length > 0) {
      allowedModules = resolveModuleAccess(rows[0].module_access ?? null, rows[0].userRole ?? userRole);
      allowedModules = applySuperadminOnlyModuleRestrictions(allowedModules, roleKey);
      allowedModules = applyRoleDenyModuleRestrictions(allowedModules, roleKey);
    }

    const allowed = Boolean(allowedModules?.includes("denied-leads"));
    return { allowed, username, userRole, roleKey };
  } catch (err) {
    console.error("Error checking denied-leads module access:", err);
    return { allowed: false, username, userRole, roleKey };
  }
}
