import { getSessionPayload } from "@/lib/auth";
import {
  attachHubSourceRows,
  fetchLeadsManageHubDashboard,
} from "@/lib/fetchLeadsManageHubDashboard";
import LeadsManageClient from "@/components/Leads/LeadsManageClient";

export const dynamic = "force-dynamic";

export default async function LeadsManagePage({ dashboardBase }) {
  const payload = await getSessionPayload();
  if (!payload) {
    return <p className="text-red-600 p-4">Unauthorized</p>;
  }

  let initialDashboard = null;

  try {
    initialDashboard = attachHubSourceRows(
      await fetchLeadsManageHubDashboard({
        username: payload.username,
        userRole: payload.role,
        range: "month",
      }),
      dashboardBase,
    );
  } catch (err) {
    console.error("[leads-manage] dashboard fetch failed:", err?.message);
  }

  return (
    <LeadsManageClient dashboardBase={dashboardBase} initialDashboard={initialDashboard} />
  );
}