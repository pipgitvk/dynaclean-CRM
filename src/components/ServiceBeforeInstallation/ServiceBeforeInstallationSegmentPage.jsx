import { notFound } from "next/navigation";
import { isServiceBeforeInstallationSegment } from "@/lib/serviceBeforeInstallationHub";
import { requireSuperAdminForServiceBeforeInstallation } from "@/lib/serviceBeforeInstallationAccess";
import ServiceBeforeInstallationDetailLoader from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationDetailLoader";

export default async function ServiceBeforeInstallationSegmentPage({
  params,
  dashboardBase,
}) {
  await requireSuperAdminForServiceBeforeInstallation(`/${dashboardBase}`);
  const { segment } = await params;
  if (!isServiceBeforeInstallationSegment(segment)) {
    notFound();
  }

  return (
    <ServiceBeforeInstallationDetailLoader
      segment={segment}
      dashboardBase={dashboardBase}
    />
  );
}