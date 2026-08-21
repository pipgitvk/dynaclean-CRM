// components/Dashboards/AccountantDashboard.jsx
import UpcomingTasks from "@/components/task/UpcomingTasks";
import AccountantPendingCards from "@/components/AccountantPendingCards";

export default function AccountantDashboard({ user, reportingManager, counts }) {
  return (
    <div className="space-y-4 md:space-y-5">
      {/* Today's Pending Summary Cards */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <AccountantPendingCards />
      </div>

      {/* Tasks */}
      <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm md:p-2">
        <UpcomingTasks leadSource={user.username} dashboardPrefix="/accounts-dashboard" />
      </div>
    </div>
  );
}