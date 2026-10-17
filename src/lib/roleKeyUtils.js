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

/** Order actions: accountant may only upload/view invoice report (not booking/dispatch). */
export function isAccountantOnlyMenuRole(role) {
  const k = normalizeRoleKey(role || "");
  if (k === "SUPERADMIN" || k === "DIRECTOR" || k === "ADMIN") return false;
  return /\bACCOUNTANT\b/.test(k) || k === "ACCOUNTANT";
}

function isSuperAdminRoleKey(k) {
  if (!k) return false;
  if (k === "SUPERADMIN") return true;
  return k.replace(/\s/g, "") === "SUPERADMIN";
}

export function isSuperAdminRole(role) {
  return isSuperAdminRoleKey(normalizeRoleKey(role || ""));
}

/** Order list: view delivery details (read-only) for admin and accountant (not superadmin). */
export function canViewOrderDeliveryDetailsRole(role) {
  const k = normalizeRoleKey(role || "");
  if (isSuperAdminRoleKey(k)) return false;
  if (k === "ADMIN") return true;
  return /\bACCOUNTANT\b/.test(k) || k === "ACCOUNTANT";
}

/** View Credit Note on order list — superadmin, admin, and accountant roles. */
export function canViewOrderCreditNoteRole(role) {
  const k = normalizeRoleKey(role || "");
  if (k === "SUPERADMIN" || k === "ADMIN") return true;
  return /\bACCOUNTANT\b/.test(k) || k === "ACCOUNTANT";
}
