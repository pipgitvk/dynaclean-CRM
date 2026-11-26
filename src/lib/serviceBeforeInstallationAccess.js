import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/auth";
import {
  canAccessServiceBeforeInstallation,
  isSuperAdminRole,
} from "@/lib/serviceBeforeInstallationRoles";

export { canAccessServiceBeforeInstallation, isSuperAdminRole };

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