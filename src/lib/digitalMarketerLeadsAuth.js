import { normalizeRoleKey } from "@/lib/roleKeyUtils";

/** Who can open the 24h leads page and bulk upload. */
const MODULE_ACCESS = new Set(["DIGITAL MARKETER", "SUPERADMIN"]);

export function canAccessDigitalMarketerLeadsModule(role) {
  return MODULE_ACCESS.has(normalizeRoleKey(role));
}

/** SUPERADMIN can re-assign after Digital Marketer used their one re-assign. */
export function canReassignLeadAsAdmin(role) {
  return normalizeRoleKey(role) === "SUPERADMIN";
}

export function isDigitalMarketerRole(role) {
  return normalizeRoleKey(role) === "DIGITAL MARKETER";
}

/** Only this rep can receive assignments from 24h DM module (UI + API). */
export const DM_MODULE_ONLY_ASSIGNEE = "KAVYA";

export function isDmModuleOnlyAssigneeUsername(username) {
  if (username == null || String(username).trim() === "") return false;
  return (
    String(username).trim().toUpperCase() === DM_MODULE_ONLY_ASSIGNEE.toUpperCase()
  );
}
