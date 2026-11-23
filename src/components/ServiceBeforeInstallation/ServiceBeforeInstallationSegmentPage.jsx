import { notFound } from "next/navigation";
import { isServiceBeforeInstallationSegment } from "@/lib/serviceBeforeInstallationHub";
import { requireSuperAdminForServiceBeforeInstallation } from "@/lib/serviceBeforeInstallationAccess";
import { getSessionPayload } from "@/lib/auth";
import ServiceBeforeInstallationDetailLoader from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationDetailLoader";

export default async function ServiceBeforeInstallationSegmentPage({
  params,
  searchParams,
  dashboardBase,
}) {
  await requireSuperAdminForServiceBeforeInstallation(`/${dashboardBase}`);
  const { segment } = await params;
  if (!isServiceBeforeInstallationSegment(segment)) {
    notFound();
  }
  const payload = await getSessionPayload();
  const userRole = payload?.role ?? "";
  const sp = (await searchParams) || {};
  const rawBucket = sp.openInstallationBucket ?? sp.open_installation_bucket;
  const initialOpenInstallationBucket = Array.isArray(rawBucket)
    ? String(rawBucket[0] ?? "")
    : String(rawBucket ?? "");

  return (
    <ServiceBeforeInstallationDetailLoader
      segment={segment}
      dashboardBase={dashboardBase}
      userRole={userRole}
      initialOpenInstallationBucket={initialOpenInstallationBucket}
    />
  );
}