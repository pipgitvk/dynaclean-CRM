// components/Dashboards/ServiceSupportDashboard.jsx
import UpcomingTasks from "@/components/task/UpcomingTasks";
import UpcomingFollowupsWidget from "@/components/service/UpcomingFollowupsWidget";
import PendingProductRegistrationCard from "@/components/service/PendingProductRegistrationCard";
import UpcomingLeads from "@/components/Leads/UpcommingLeads";

export default function ServiceSupportDashboard({ user }) {
  return (
    <div className="space-y-4 md:space-y-6">

      <PendingProductRegistrationCard />

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
