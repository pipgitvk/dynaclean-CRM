// components/Dashboards/ServiceSupportDashboard.jsx
import UpcomingTasks from "@/components/task/UpcomingTasks";
import UpcomingFollowupsWidget from "@/components/service/UpcomingFollowupsWidget";
import PendingProductRegistrationCard from "@/components/service/PendingProductRegistrationCard";

export default function ServiceSupportDashboard({ user }) {
  return (
    <div className="space-y-4 md:space-y-6">

      <PendingProductRegistrationCard />

      {/* Upcoming Tasks */}
      <div className="bg-white rounded-xl shadow-md">
        <UpcomingTasks leadSource={user.username} />
      </div>

      {/* NEW: Upcoming Follow-ups (future scheduled) */}
      <UpcomingFollowupsWidget username={user.username} userRole={user.userRole} />

    </div>
  );
}
