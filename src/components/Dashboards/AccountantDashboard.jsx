// components/Dashboards/AccountantDashboard.jsx
import ProfilePicUploader from "@/app/user-dashboard/ProfilePicUploader";
import AttendanceTracker from "@/components/AttendanceTracker";
import UpcomingTasks from "@/components/task/UpcomingTasks";
import TodayReportButton from "@/components/TodayReportButton";
import LeaveApprovalButton from "@/components/LeaveApprovalButton";
import AccountantPendingCards from "@/components/AccountantPendingCards";

export default function AccountantDashboard({ user, counts }) {
  const welcomeNameClass = "text-green-700";

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Welcome & Attendance Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 md:gap-3">
        {/* Welcome Section */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-2 md:p-2.5">
          <div className="flex flex-col gap-2">
            {/* Profile pic + name */}
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <ProfilePicUploader user={user} />
              <div className="space-y-0.5 flex-1">
                <h1 className="text-lg md:text-xl font-semibold leading-tight">
                  Welcome, <span className={welcomeNameClass}>{user.username}</span>
                </h1>
                <p className="text-gray-500 text-xs">Role: {user.userRole}</p>
              </div>
            </div>

            {/* Buttons row */}
            <div className="flex flex-row gap-1.5 justify-start sm:justify-end">
              <TodayReportButton />
              <LeaveApprovalButton />
            </div>
          </div>
        </div>

        {/* Attendance Tracker */}
        <div className="bg-white rounded-xl shadow-md p-2 md:p-2.5 min-w-0">
          <AttendanceTracker username={user.username} role={user.userRole} />
        </div>
      </div>

      {/* Today's Pending Summary Cards */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <AccountantPendingCards />
      </div>

      {/* Tasks */}
      <div className="bg-white rounded-xl shadow-md">
        <UpcomingTasks leadSource={user.username} />
      </div>
    </div>
  );
}