import { normalizeRoleKey } from "@/lib/adminAttendanceRulesAuth";

/** Who can open the 24h leads page and bulk upload. */
const MODULE_ACCESS = new Set([
  "DIGITAL MARKETER",
  "SUPERADMIN",
  "ADMIN",
]);

export function canAccessDigitalMarketerLeadsModule(role) {
  return MODULE_ACCESS.has(normalizeRoleKey(role));
}

/** ADMIN / SUPERADMIN can re-assign even after DM used their one re-assign. */
export function canReassignLeadAsAdmin(role) {
  const r = normalizeRoleKey(role);
  return r === "SUPERADMIN" || r === "ADMIN";
}

export function isDigitalMarketerRole(role) {
  return normalizeRoleKey(role) === "DIGITAL MARKETER";
}
