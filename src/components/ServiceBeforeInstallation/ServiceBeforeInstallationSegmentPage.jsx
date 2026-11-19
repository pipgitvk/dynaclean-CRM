import { notFound } from "next/navigation";
import { isServiceBeforeInstallationSegment } from "@/lib/serviceBeforeInstallationHub";
import { requireSuperAdminForServiceBeforeInstallation } from "@/lib/serviceBeforeInstallationAccess";
import ServiceBeforeInstallationDetailClient from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationDetailClient";

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
    <ServiceBeforeInstallationDetailClient
      segment={segment}
      dashboardBase={dashboardBase}
    />
  );
}