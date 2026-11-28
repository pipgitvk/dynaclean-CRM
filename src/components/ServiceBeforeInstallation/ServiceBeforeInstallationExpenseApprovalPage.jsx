import { requireSuperAdminForServiceBeforeInstallation } from "@/lib/serviceBeforeInstallationAccess";
import { getSessionPayload } from "@/lib/auth";
import { fetchExpenseDashboardRows } from "@/lib/fetchExpenseDashboardRows";
import ServiceBeforeInstallationExpenseApprovalClient from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationExpenseApprovalClient";

export const dynamic = "force-dynamic";

export default async function ServiceBeforeInstallationExpenseApprovalPage({
  dashboardBase,
}) {
  await requireSuperAdminForServiceBeforeInstallation(`/${dashboardBase}`);
  const payload = await getSessionPayload();
  const role = payload?.role ?? "";
  const approverUsername = payload?.username ?? "";

  let rows = [];
  try {
    rows = await fetchExpenseDashboardRows();
  } catch (err) {
    console.error("Expense approval dashboard fetch failed:", err);
    return (
      <p className="p-6 text-red-600">
        Could not load expenses. Please try again or use the full expense list.
      </p>
    );
  }

  return (
    <ServiceBeforeInstallationExpenseApprovalClient
      dashboardBase={dashboardBase}
      rows={rows}
      role={role}
      approverUsername={approverUsername}
    />
  );
}