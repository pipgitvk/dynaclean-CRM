import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/auth";
import {
  canAccessServiceBeforeInstallation,
  isSuperAdminRole,
} from "@/lib/serviceBeforeInstallationRoles";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";

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

const EXPENSE_APPROVAL_DASHBOARD_ROLES = new Set([
  "SUPERADMIN",
  "DIRECTOR",
  "ADMIN",
  "ACCOUNTANT",
  "PRODUCTION ACCOUNTANT",
  "HR_MANAGER",
]);

export function canAccessExpenseApprovalDashboard(role) {
  const key = normalizeRoleKey(role);
  if (EXPENSE_APPROVAL_DASHBOARD_ROLES.has(key)) return true;
  return canAccessServiceBeforeInstallation(role);
}

/** SBI expense approval list — wider roles than full SBI hub. */
export async function requireExpenseApprovalDashboard(redirectTo = "/accounts-dashboard") {
  const payload = await getSessionPayload();
  if (!payload || !canAccessExpenseApprovalDashboard(payload.role)) {
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