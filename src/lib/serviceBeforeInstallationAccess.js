import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/adminAttendanceRulesAuth";

export function isSuperAdminRole(role) {
  return normalizeRoleKey(role) === "SUPERADMIN";
}

export async function requireSuperAdminForServiceBeforeInstallation(
  redirectTo = "/admin-dashboard",
) {
  const payload = await getSessionPayload();
  if (!payload || !isSuperAdminRole(payload.role)) {
    redirect(redirectTo);
  }
  return payload;
}

export async function assertSuperAdminApiAccess() {
  const payload = await getSessionPayload();
  if (!payload || !isSuperAdminRole(payload.role)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, payload };
}