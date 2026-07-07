// components/Dashboards/DefaultDashboard.jsx
import ProfilePicUploader from "@/app/user-dashboard/ProfilePicUploader";
import AttendanceTracker from "@/components/AttendanceTracker";
import UpcomingTasks from "@/components/task/UpcomingTasks";
import UpcomingLeads from "@/components/Leads/UpcommingLeads";
import HrTargetVsCompletedChart from "@/components/empcrm/HrTargetVsCompletedChart";
import HiringCandidatesFollowUpSection from "@/components/empcrm/hiring/HiringCandidatesFollowUpSection";
import { canAccessHiringModule, canViewHrTargetChart } from "@/lib/hrTargetEligibleRoles";
import FastCardsWidget from "@/components/FastCardsWidget";
import TodayReportButton from "@/components/TodayReportButton";
import HrTodayReportButton from "@/components/HrTodayReportButton";
import LeaveApprovalButton from "@/components/LeaveApprovalButton";
import UpcomingFollowupsWidget from "@/components/service/UpcomingFollowupsWidget";

export default function DefaultDashboard({ user, counts }) {
  const showHrTargetChart = canViewHrTargetChart(user?.userRole);
  const showHrCandidatesFollowUp = canAccessHiringModule(user?.userRole);
  const isHrRole = String(user?.userRole || "").trim() === "HR";
  const isEaRole = String(user?.userRole || "").trim() === "EA";
  const welcomeNameClass = isHrRole ? "text-sky-600" : "text-green-700";

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Welcome, Attendance & Fast Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-4 md:p-6">
          <div className="flex flex-col gap-4">
            {/* Profile pic + name */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <ProfilePicUploader user={user} />
              <div className="space-y-2 flex-1">
                <h1 className="text-3xl font-semibold">
                  Welcome, <span className={welcomeNameClass}>{user.username}</span>
                </h1>
                <p className="text-gray-500 text-sm">Role: {user.userRole}</p>
              </div>
            </div>

            {/* Buttons row - separate on mobile */}
            <div className="flex flex-row gap-2 justify-start sm:justify-end">
              <TodayReportButton />
              <LeaveApprovalButton />
            </div>

            {/* Fast Cards */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Fast Cards</p>
              <FastCardsWidget />
            </div>
          </div>
        </div>

        <div
          className={`bg-white rounded-xl shadow-md p-4 md:p-6 min-w-0 ${showHrTargetChart ? "" : "lg:col-span-1"}`}
        >
          <AttendanceTracker username={user.username} role={user.userRole} />
        </div>
      </div>

      {showHrTargetChart && (
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 min-w-0">
          <HrTargetVsCompletedChart />
        </div>
      )}

      {showHrCandidatesFollowUp && (
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 min-w-0">
          <HiringCandidatesFollowUpSection showOpenHiringLink />
        </div>
      )}

      {/* Tasks */}
      <div className="bg-white rounded-xl shadow-md">
        <UpcomingTasks leadSource={user.username} />
      </div>

      {/* Upcoming Follow-ups - Hidden for EA role */}
      {!isEaRole && (
        <UpcomingFollowupsWidget username={user.username} userRole={user.userRole} />
      )}

      {/* Leads */}
      <div className="bg-white rounded-xl shadow-md">
        <UpcomingLeads leadSource={user.username} />
      </div>

    </div>
  );
}
