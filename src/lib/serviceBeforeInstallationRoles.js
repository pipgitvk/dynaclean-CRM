import { normalizeRoleKey } from "@/lib/roleKeyUtils";

/** Client-safe role checks (no next/headers). */

export function isSuperAdminRole(role) {
  return normalizeRoleKey(role) === "SUPERADMIN";
}

/** CSV Export on SBI lists — SUPERADMIN only (not Sales Cum Backoffice / Service Support). */
export function canExportServiceBeforeInstallationCsv(role) {
  return isSuperAdminRole(role);
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