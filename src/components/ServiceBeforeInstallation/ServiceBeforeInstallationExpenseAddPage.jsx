import { requireExpenseApprovalDashboard } from "@/lib/serviceBeforeInstallationAccess";
import ServiceBeforeInstallationExpenseAddClient from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationExpenseAddClient";

export const dynamic = "force-dynamic";

export default async function ServiceBeforeInstallationExpenseAddPage({ dashboardBase }) {
  await requireExpenseApprovalDashboard(`/${dashboardBase}`);

  return <ServiceBeforeInstallationExpenseAddClient dashboardBase={dashboardBase} />;
}