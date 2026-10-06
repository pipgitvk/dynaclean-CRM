import { redirect } from "next/navigation";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getEngineerIdFromPayload } from "@/lib/thirdPartyEngineerPortalSession";
import { fetchThirdPartyEngineerServiceRecords } from "@/lib/fetchThirdPartyEngineerServiceRecords";
import { THIRD_PARTY_ENGINEER_ROLE } from "@/lib/thirdPartyEngineerPortalSession";
import ServiceTable from "@/components/services/ServiceTable";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function ThirdPartyEngineerServicesPage() {
  const payload = await getSessionPayload();
  const engineerId = getEngineerIdFromPayload(payload);
  if (!engineerId) redirect("/login");

  const conn = await getDbConnection();
  let serviceRecords = [];
  try {
    serviceRecords = await fetchThirdPartyEngineerServiceRecords(conn, engineerId);
  } catch (e) {
    console.error(e);
  }

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      <h2 className="text-xl sm:text-2xl lg:text-3xl text-gray-800 mb-4">Service Reports</h2>
      <ServiceTable
        serviceRecords={serviceRecords}
        role={THIRD_PARTY_ENGINEER_ROLE}
        dashboardPathOverride="user-dashboard"
      />
    </div>
  );
}
