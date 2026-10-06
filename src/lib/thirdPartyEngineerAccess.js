import { getSessionPayload } from "@/lib/auth";

export async function verifyThirdPartyEngineerModuleAccess() {
  const payload = await getSessionPayload();
  if (!payload) {
    return { authorized: false, error: "Unauthorized", status: 401, payload: null };
  }

  const roleNorm = String(payload.role || payload.userRole || "")
    .toUpperCase()
    .trim();

  const allowed = ["SUPERADMIN", "ADMIN", "SERVICE SUPPORT"];
  if (!allowed.includes(roleNorm)) {
    return {
      authorized: false,
      error: "Forbidden: Only Super Admin, Admin, and Service Support can access this resource",
      status: 403,
      payload: null,
    };
  }

  return { authorized: true, payload, roleNorm };
}

/** Returns engineer row or null; sets forbidden if non-superadmin and not owner */
export async function getEngineerIfAccessible(conn, engineerId, payload, roleNorm) {
  const [rows] = await conn.execute(
    `SELECT engineer_id, name, mobile, email, created_by
     FROM third_party_service_engineers WHERE engineer_id = ? LIMIT 1`,
    [engineerId]
  );
  if (!rows.length) {
    return { engineer: null, forbidden: false };
  }
  const engineer = rows[0];
  const username = payload.username || payload.email || "";
  if (roleNorm !== "SUPERADMIN" && engineer.created_by !== username) {
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
