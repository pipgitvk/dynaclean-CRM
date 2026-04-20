import { normalizeRoleKey } from "./roleKeyUtils";

export { normalizeRoleKey };

/**
 * Attendance rules (admin) — only these roles (JWT / rep_list.userRole).
 * SUPERADMIN, ADMIN, HR.
 * Keep in sync with getAdminSidebarMenuItems "Attendance rules".
 */
export const ATTENDANCE_RULES_ALLOWED_ROLES = [
  "SUPERADMIN",
  "ADMIN",
  "HR",
];

const MANAGE_ATTENDANCE_RULES_ROLES = new Set(
  ATTENDANCE_RULES_ALLOWED_ROLES.map((r) => normalizeRoleKey(r))
);

/** EMPCRM admin attendance + main admin — may submit regularization on behalf of an employee. */
const PROXY_ATTENDANCE_REG_ROLES = new Set(
  [
    "SUPERADMIN",
    "ADMIN",
    "HR",
    "HR HEAD",
    "HR Executive",
  ].map((r) => normalizeRoleKey(r))
);

export function canManageAttendanceRules(role) {
  return MANAGE_ATTENDANCE_RULES_ROLES.has(normalizeRoleKey(role));
}

export function canProxyAttendanceRegularization(role) {
  return PROXY_ATTENDANCE_REG_ROLES.has(normalizeRoleKey(role));
}

/**
 * JWT `role` is set at login from emplist/rep_list row used for auth; it can
 * disagree with `rep_list.userRole` (e.g. admin in both tables). Navbar uses
 * /api/me which may show SUPERADMIN while the token still has UNKNOWN.
 * If JWT role is not allowed, re-read canonical role from DB (rep_list first).
 */
export async function resolveRoleForAttendanceAdmin(payload) {
  if (!payload?.username) return null;
  if (canManageAttendanceRules(payload.role)) return payload.role;
  try {
    const { getDbConnection } = await import("@/lib/db");
    const conn = await getDbConnection();
    const [repRows] = await conn.query(
      "SELECT userRole FROM rep_list WHERE LOWER(username) = LOWER(?) LIMIT 1",
      [payload.username]
    );
    const ur = repRows[0]?.userRole;
    if (ur != null && String(ur).trim() !== "") return String(ur).trim();
    const [empRows] = await conn.query(
      "SELECT userRole FROM emplist WHERE LOWER(username) = LOWER(?) LIMIT 1",
      [payload.username]
    );
    const ur2 = empRows[0]?.userRole;
    if (ur2 != null && String(ur2).trim() !== "") return String(ur2).trim();
  } catch (e) {
    console.error("resolveRoleForAttendanceAdmin:", e);
  }
  return payload.role;
}
