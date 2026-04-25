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

export default function DefaultDashboard({ user }) {
  const showHrTargetChart = canViewHrTargetChart(user?.userRole);
  const showHrCandidatesFollowUp = canAccessHiringModule(user?.userRole);
  const isHrRole = String(user?.userRole || "").trim() === "HR";
  const welcomeNameClass = isHrRole ? "text-sky-600" : "text-green-700";

  return (
    <div className="space-y-4 md:space-y-6">

      {/* Welcome + Attendance (Target vs completed moved below, like Candidates follow-up) */}
      <div
        className={`grid grid-cols-1 gap-4 md:gap-6 ${showHrTargetChart ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}
      >
        <div
          className={`bg-white rounded-xl shadow-md p-4 md:p-6 min-w-0 ${showHrTargetChart ? "" : "lg:col-span-2"}`}
        >
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <ProfilePicUploader user={user} />
            <div className="flex-1">
              <h1 className="text-3xl font-semibold">
                Welcome, <span className={welcomeNameClass}>{user.username}</span>
              </h1>
              <p className="text-sm text-gray-500">Role: {user.userRole}</p>
            </div>
            <div className="flex flex-col gap-2">
              <TodayReportButton />
              <HrTodayReportButton userRole={user?.userRole} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Fast Cards</p>
            <FastCardsWidget />
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
