import { buildAutoCheckoutApprovalItems } from "@/lib/autoCheckoutApprovalQueue";

/** Automatic check-outs waiting for HR approval (this month by default). */
export async function countPendingAutoCheckoutApprovals(conn, options = {}) {
  const { monthScope = true } = options;
  let fromDate = null;
  let toDate = null;
  if (monthScope) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    fromDate = `${y}-${m}-01`;
    toDate = `${y}-${m}-${d}`;
  }
  const items = await buildAutoCheckoutApprovalItems(conn, {
    fromDate,
    toDate,
    statusFilter: "pending",
  });
  return items.length;
}
