import LeadsManageMetaLeadsClient from "@/components/Leads/LeadsManageMetaLeadsClient";

export const dynamic = "force-dynamic";

export default function LeadsManageMetaLeadsPage({
  dashboardBase = "admin-dashboard",
}) {
  return <LeadsManageMetaLeadsClient dashboardBase={dashboardBase} />;
}