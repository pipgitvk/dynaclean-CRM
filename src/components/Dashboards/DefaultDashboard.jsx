// components/Dashboards/DefaultDashboard.jsx
import ProfilePicUploader from "@/app/user-dashboard/ProfilePicUploader";
import AttendanceTracker from "@/components/AttendanceTracker";
import UpcomingTasks from "@/components/task/UpcomingTasks";
import UpcomingLeads from "@/components/Leads/UpcommingLeads";
import HrTargetVsCompletedChart from "@/components/empcrm/HrTargetVsCompletedChart";
import { canViewHrTargetChart } from "@/lib/hrTargetEligibleRoles";

export default function DefaultDashboard({ user }) {
  const showHrTargetChart = canViewHrTargetChart(user?.userRole);

  return (
    <div className="space-y-4 md:space-y-6">

      {/* Welcome + Attendance + Target chart (HR: chart to the right of attendance) */}
      <div
        className={`grid grid-cols-1 gap-4 md:gap-6 ${showHrTargetChart ? "lg:grid-cols-12" : "lg:grid-cols-3"}`}
      >
        <div
          className={`bg-white rounded-xl shadow-md p-4 md:p-6 min-w-0 ${showHrTargetChart ? "lg:col-span-5" : "lg:col-span-2"}`}
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <ProfilePicUploader user={user} />
            <div>
              <h1 className="text-3xl font-semibold">
                Welcome, <span className="text-green-700">{user.username}</span>
              </h1>
              <p className="text-sm text-gray-500">Role: {user.userRole}</p>
            </div>
          </div>
        </div>

        <div
          className={`bg-white rounded-xl shadow-md p-4 md:p-6 min-w-0 ${showHrTargetChart ? "lg:col-span-3" : "lg:col-span-1"}`}
        >
          <AttendanceTracker username={user.username} role={user.userRole} />
        </div>

        {showHrTargetChart && (
          <div className="lg:col-span-4 min-w-0">
            <HrTargetVsCompletedChart />
          </div>
        )}
      </div>

      {/* Tasks + Leads */}
      <div className="grid grid-cols-1 gap-4 md:gap-6">

        <div className="bg-white rounded-xl shadow-md">
          <UpcomingTasks leadSource={user.username} />
        </div>

        <div className="bg-white rounded-xl shadow-md">
          <UpcomingLeads leadSource={user.username} />
        </div>

      </div>

    </div>
  );
}