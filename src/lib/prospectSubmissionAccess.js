import { normalizeRoleKey } from "@/lib/roleKeyUtils";

/** Roles that should not see Add Prospect (header / submit). */
const PROSPECT_SUBMIT_DENIED_ROLES = new Set([
  "SUPERADMIN",
  "SERVICE ENGINEER",
  "SERVICE TECHNICIAN",
  "WELDER",
  "WELDER HELPER",
  "PAINTER",
  "MACHINE OPERATOR",
]);

export function canSubmitProspect(role) {
  const roleNorm = normalizeRoleKey(role || "");
  if (!roleNorm) return false;
  if (PROSPECT_SUBMIT_DENIED_ROLES.has(roleNorm)) return false;
  // Catch "SERVICE SUPPORT " style trailing spaces via normalizeRoleKey
  if (roleNorm.includes("SERVICE ENGINEER")) return false;
  if (roleNorm.includes("WELDER")) return false;
  if (roleNorm.includes("PAINTER")) return false;
  return true;
}
