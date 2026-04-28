/**
 * Pure role string normalization — safe to import from Client Components.
 * (No DB / Node-only deps — keep it that way.)
 */
export function normalizeRoleKey(role) {
  if (role == null || role === "") return "";
  return String(role).trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * JWT `payload.role` comes from DB `userRole` (exact string). Treat ACCOUNTANT and
 * variants such as PRODUCTION ACCOUNTANT the same for Main Expenses admin routes.
 */
export function isJwtAccountingRole(role) {
  const k = normalizeRoleKey(role || "");
  if (k === "SUPERADMIN") return true;
  if (k === "ACCOUNTANT") return true;
  return /\bACCOUNTANT\b/.test(k);
}
