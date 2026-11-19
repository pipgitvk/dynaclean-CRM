import LeadsPendingReassignClient from "@/components/Leads/LeadsPendingReassignClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return <LeadsPendingReassignClient dashboardBase="sales-dashboard" />;
}