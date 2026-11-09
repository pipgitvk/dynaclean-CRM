import { getRepListUserRole } from "@/lib/repListUserRole";
import { isWarehouseInchargeRole } from "@/lib/warehouseInAccess";

/** Server-only: invoice UI + partial warehouse-in API for Warehouse Incharge. */
export async function usesWarehouseInInchargeFlow(payload) {
  if (!payload) return false;
  let role = payload.role ?? payload.userRole;
  if (payload.username) {
    try {
      const repRole = await getRepListUserRole(payload.username);
      if (repRole) role = repRole;
    } catch {
      /* keep JWT role */
    }
  }
  return isWarehouseInchargeRole(role);
}
