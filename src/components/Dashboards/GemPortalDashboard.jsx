// components/Dashboards/GemPortalDashboard.jsx
import EmployeeTargetGraph from "@/components/targets/EmployeeTargetGraph";
import UpcomingTasks from "@/components/task/UpcomingTasks";
import UpcomingLeads from "@/components/Leads/UpcommingLeads";
import FastCardsWidget from "@/components/FastCardsWidget";

export default function GemPortalDashboard({ user, reportingManager }) {
  return (
    <div className="space-y-4 md:space-y-6">

      {/* Target */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <EmployeeTargetGraph />
      </div>

      {/* Leads + Tasks */}
      <div className="grid grid-cols-1 gap-4 md:gap-6">
        <div className="bg-white rounded-xl shadow-md">
          <UpcomingLeads leadSource={user.username} userRole={user.userRole} />
        </div>

        <div className="bg-white rounded-xl shadow-md">
          <UpcomingTasks leadSource={user.username} />
        </div>
      </div>

    </div>
  );
}
