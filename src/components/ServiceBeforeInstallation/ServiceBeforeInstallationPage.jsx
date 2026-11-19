import { requireSuperAdminForServiceBeforeInstallation } from "@/lib/serviceBeforeInstallationAccess";
import { fetchServiceBeforeInstallationHubCounts } from "@/lib/serviceBeforeInstallationQueries";
import ServiceBeforeInstallationHubClient from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationHubClient";

export const dynamic = "force-dynamic";

export default async function ServiceBeforeInstallationPage({ dashboardBase }) {
  await requireSuperAdminForServiceBeforeInstallation(`/${dashboardBase}`);

  let initialCounts = null;
  try {
    initialCounts = await fetchServiceBeforeInstallationHubCounts({});
  } catch (err) {
    console.error("[service-before-installation] hub:", err?.message);
  }

  return (
    <ServiceBeforeInstallationHubClient
      dashboardBase={dashboardBase}
      initialCounts={initialCounts}
    />
  );
}