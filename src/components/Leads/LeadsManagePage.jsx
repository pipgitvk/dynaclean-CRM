import { getSessionPayload } from "@/lib/auth";
import { fetchLeadsManageCounts } from "@/lib/fetchLeadsManageCounts";
import LeadsManageClient from "@/components/Leads/LeadsManageClient";

export const dynamic = "force-dynamic";

export default async function LeadsManagePage({ dashboardBase }) {
  const payload = await getSessionPayload();
  if (!payload) {
    return <p className="text-red-600 p-4">Unauthorized</p>;
  }

  let counts = {
    social_media: 0,
    google_ads: 0,
    indiamart: 0,
    website_direct: 0,
    manager_assigned: 0,
  };

  try {
    counts = await fetchLeadsManageCounts({
      username: payload.username,
      userRole: payload.role,
    });
  } catch (err) {
    console.error("[leads-manage] count fetch failed:", err?.message);
  }

  return <LeadsManageClient counts={counts} dashboardBase={dashboardBase} />;
}