import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/adminAttendanceRulesAuth";

export function isSuperAdminRole(role) {
  return normalizeRoleKey(role) === "SUPERADMIN";
}

const SERVICE_BEFORE_INSTALLATION_ROLES = new Set([
  "SUPERADMIN",
  "DIRECTOR",
  "SALES CUM BACKOFFICE",
  "SERVICE SUPPORT",
]);

export function canAccessServiceBeforeInstallation(role) {
  const key = normalizeRoleKey(role);
  return Boolean(key && SERVICE_BEFORE_INSTALLATION_ROLES.has(key));
}

export async function requireSuperAdminForServiceBeforeInstallation(
  redirectTo = "/admin-dashboard",
) {
  const payload = await getSessionPayload();
  if (!payload || !canAccessServiceBeforeInstallation(payload.role)) {
    redirect(redirectTo);
  }
  return payload;
}

export async function assertSuperAdminApiAccess() {
  const payload = await getSessionPayload();
  if (!payload || !canAccessServiceBeforeInstallation(payload.role)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, payload };
}