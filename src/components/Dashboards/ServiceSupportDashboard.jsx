// components/Dashboards/ServiceSupportDashboard.jsx
import UpcomingTasks from "@/components/task/UpcomingTasks";
import UpcomingFollowupsWidget from "@/components/service/UpcomingFollowupsWidget";
import PendingProductRegistrationCard from "@/components/service/PendingProductRegistrationCard";
import UpcomingLeads from "@/components/Leads/UpcommingLeads";
import ServiceSupportTodayReportCard from "@/components/service/ServiceSupportTodayReportCard";

export default function ServiceSupportDashboard({ user }) {
  return (
    <div className="space-y-4 md:space-y-6">

      <div className="flex flex-wrap gap-3">
        <div className="w-full max-w-[280px]">
          <ServiceSupportTodayReportCard />
        </div>
        <div className="w-full max-w-[280px]">
          <PendingProductRegistrationCard />
        </div>
      </div>

      {/* Upcoming Enquiry (leads followups) */}
      <div className="bg-white rounded-xl shadow-md">
        <UpcomingLeads leadSource={user.username} userRole={user.userRole} />
      </div>

      {/* Upcoming Tasks */}
      <div className="bg-white rounded-xl shadow-md">
        <UpcomingTasks leadSource={user.username} />
      </div>

      {/* Upcoming Follow-ups (machines service followups) */}
      <UpcomingFollowupsWidget username={user.username} userRole={user.userRole} />

    </div>
  );
}
