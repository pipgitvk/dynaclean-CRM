import { requireSuperAdminForServiceBeforeInstallation } from "@/lib/serviceBeforeInstallationAccess";
import ServiceBeforeInstallationHubClient from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationHubClient";

export const dynamic = "force-dynamic";

/** Auth only on SSR — KPI counts load on the client so the hub shell paints immediately. */
export default async function ServiceBeforeInstallationPage({ dashboardBase }) {
  await requireSuperAdminForServiceBeforeInstallation(`/${dashboardBase}`);

  return (
    <ServiceBeforeInstallationHubClient
      dashboardBase={dashboardBase}
      initialCounts={null}
    />
  );
}
