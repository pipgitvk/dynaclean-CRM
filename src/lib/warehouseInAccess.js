import { normalizeRoleKey } from "@/lib/roleKeyUtils";

/** Client-safe — no DB imports. */
export function isWarehouseInchargeRole(role) {
  return normalizeRoleKey(role) === "WAREHOUSE INCHARGE";
}
