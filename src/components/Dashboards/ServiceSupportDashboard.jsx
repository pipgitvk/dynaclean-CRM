// components/Dashboards/ServiceSupportDashboard.jsx
import ProfilePicUploader from "@/app/user-dashboard/ProfilePicUploader";
import AttendanceTracker from "@/components/AttendanceTracker";
import UpcomingTasks from "@/components/task/UpcomingTasks";
import FastCardsWidget from "@/components/FastCardsWidget";
import TodayReportButton from "@/components/TodayReportButton";
import LeaveApprovalButton from "@/components/LeaveApprovalButton";
import UpcomingFollowupsWidget from "@/components/service/UpcomingFollowupsWidget";

export default function ServiceSupportDashboard({ user }) {
  return (
    <div className="space-y-4 md:space-y-6">

      {/* Welcome + Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-4 md:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <ProfilePicUploader user={user} />
              <div className="space-y-2 flex-1">
                <h1 className="text-3xl font-semibold">
                  Welcome, <span className="text-indigo-600">{user.username}</span>
                </h1>
                <p className="text-gray-500 text-sm">Role: {user.userRole}</p>
              </div>
            </div>
            <div className="flex flex-row gap-2 justify-start sm:justify-end">
              <TodayReportButton />
              <LeaveApprovalButton />
            </div>
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Fast Cards</p>
              <FastCardsWidget />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <AttendanceTracker username={user.username} role={user.userRole} />
        </div>
      </div>

      {/* Upcoming Tasks */}
      <div className="bg-white rounded-xl shadow-md">
        <UpcomingTasks leadSource={user.username} />
      </div>

      {/* NEW: Upcoming Follow-ups (future scheduled) */}
      <UpcomingFollowupsWidget username={user.username} userRole={user.userRole} />

    </div>
  );
}
