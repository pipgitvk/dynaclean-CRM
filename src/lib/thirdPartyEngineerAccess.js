import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import {
  isServiceSupportRole,
  sqlColumnInActiveServiceSupportUsers,
} from "@/lib/serviceSupportTeamScope";

export function isThirdPartyEngineerModuleRole(role) {
  const k = normalizeRoleKey(role);
  return k === "SUPERADMIN" || k === "ADMIN" || k === "SERVICE SUPPORT";
}

export async function verifyThirdPartyEngineerModuleAccess() {
  const payload = await getSessionPayload();
  if (!payload) {
    return { authorized: false, error: "Unauthorized", status: 401, payload: null };
  }

  const roleNorm = normalizeRoleKey(payload.role || payload.userRole || "");

  if (!isThirdPartyEngineerModuleRole(roleNorm)) {
    return {
      authorized: false,
      error: "Forbidden: Only Super Admin, Admin, and Service Support can access this resource",
      status: 403,
      payload: null,
    };
  }

  return { authorized: true, payload, roleNorm };
}

/** List/count filter: SUPERADMIN → all; SERVICE SUPPORT → team pool; others → own rows. */
export function buildThirdPartyEngineerCreatedByWhere({
  roleNorm,
  username,
  columnExpr = "created_by",
}) {
  const roleKey = normalizeRoleKey(roleNorm);

  if (roleKey === "SUPERADMIN") {
    return { sql: "", params: [] };
  }
  if (isServiceSupportRole(roleKey)) {
    return {
      sql: ` AND ${sqlColumnInActiveServiceSupportUsers(columnExpr)}`,
      params: [],
    };
  }
  return {
    sql: ` AND ${columnExpr} COLLATE utf8mb4_unicode_ci = ?`,
    params: [username],
  };
}

/** Same visibility rules as GET /api/third-party-engineers list. */
export async function canAccessThirdPartyEngineerById(conn, engineerId, payload) {
  const roleKey = normalizeRoleKey(payload?.role || payload?.userRole || "");
  const username = String(payload?.username || payload?.email || "").trim();

  const scope = buildThirdPartyEngineerCreatedByWhere({
    roleNorm: roleKey,
    username,
    columnExpr: "created_by",
  });

  const [rows] = await conn.execute(
    `SELECT engineer_id FROM third_party_service_engineers WHERE engineer_id = ?${scope.sql} LIMIT 1`,
    [engineerId, ...scope.params],
  );
  return rows.length > 0;
}

/** @deprecated use canAccessThirdPartyEngineerById */
export async function isThirdPartyEngineerRecordAccessible(
  conn,
  { createdBy, roleNorm, username, engineerId, payload },
) {
  if (engineerId != null && payload) {
    return canAccessThirdPartyEngineerById(conn, engineerId, payload);
  }
  const roleKey = normalizeRoleKey(roleNorm);
  if (roleKey === "SUPERADMIN") return true;

  const u = String(username || "").trim();
  const owner = String(createdBy || "").trim();
  if (owner && u && owner.toLowerCase() === u.toLowerCase()) return true;

  if (!isServiceSupportRole(roleKey) || !owner) return false;

  const [rows] = await conn.execute(
    `SELECT 1 AS ok FROM rep_list
     WHERE UPPER(TRIM(userRole)) = 'SERVICE SUPPORT' AND status = 1
       AND TRIM(username) COLLATE utf8mb4_unicode_ci = TRIM(?) COLLATE utf8mb4_unicode_ci
     LIMIT 1`,
    [owner],
  );
  return rows.length > 0;
}

/** Returns engineer row or null; sets forbidden if user cannot access this record */
export async function getEngineerIfAccessible(conn, engineerId, payload) {
  const [rows] = await conn.execute(
    `SELECT engineer_id, name, mobile, email, created_by
     FROM third_party_service_engineers WHERE engineer_id = ? LIMIT 1`,
    [engineerId],
  );
  if (!rows.length) {
    return { engineer: null, forbidden: false };
  }
  const engineer = rows[0];
  const allowed = await canAccessThirdPartyEngineerById(conn, engineerId, payload);
  if (!allowed) {
    return { engineer: null, forbidden: true };
  }
  return { engineer, forbidden: false };
}

export function normalizeDatetimeLocal(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.includes("T")) {
    const replaced = raw.replace("T", " ");
    if (replaced.length === 16) return `${replaced}:00`;
    return replaced;
  }
  return raw;
}
