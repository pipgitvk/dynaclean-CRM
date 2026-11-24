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
  const rawOcBucket = sp.openCompletionsBucket ?? sp.open_completions_bucket;
  const initialOpenCompletionsBucket = Array.isArray(rawOcBucket)
    ? String(rawOcBucket[0] ?? "")
    : String(rawOcBucket ?? "");
  const rawWarrantyBucket = sp.warrantyBucket ?? sp.warranty_bucket;
  const initialWarrantyBucket = Array.isArray(rawWarrantyBucket)
    ? String(rawWarrantyBucket[0] ?? "")
    : String(rawWarrantyBucket ?? "");
  const rawAmcBucket = sp.amcBucket ?? sp.amc_bucket;
  const initialAmcBucket = Array.isArray(rawAmcBucket)
    ? String(rawAmcBucket[0] ?? "")
    : String(rawAmcBucket ?? "");

  return (
    <ServiceBeforeInstallationDetailLoader
      segment={segment}
      dashboardBase={dashboardBase}
      userRole={userRole}
      initialOpenInstallationBucket={initialOpenInstallationBucket}
      initialOpenCompletionsBucket={initialOpenCompletionsBucket}
      initialWarrantyBucket={initialWarrantyBucket}
      initialAmcBucket={initialAmcBucket}
    />
  );
}