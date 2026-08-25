// components/Dashboards/DefaultDashboard.jsx
import UpcomingTasks from "@/components/task/UpcomingTasks";
import UpcomingLeads from "@/components/Leads/UpcommingLeads";
import HrTargetVsCompletedChart from "@/components/empcrm/HrTargetVsCompletedChart";
import HiringCandidatesFollowUpSection from "@/components/empcrm/hiring/HiringCandidatesFollowUpSection";
import { canAccessHiringModule, canViewHrTargetChart } from "@/lib/hrTargetEligibleRoles";
import TodayReportButton from "@/components/TodayReportButton";
import LeaveApprovalButton from "@/components/LeaveApprovalButton";
import ExpenseApprovalButton from "@/components/ExpenseApprovalButton";
import UpcomingFollowupsWidget from "@/components/service/UpcomingFollowupsWidget";
import DigitalMarketingQuickCards from "@/components/DigitalMarketingQuickCards";
import TopBacklinksKeywordsCards from "@/components/digital-marketing/TopBacklinksKeywordsCards";

const salesCard =
  "flex min-h-0 flex-col rounded-xl border border-slate-100 bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_2px_4px_-2px_rgba(0,0,0,0.05)] md:p-5";

export default function DefaultDashboard({ user, reportingManager, counts }) {
  const showHrTargetChart = canViewHrTargetChart(user?.userRole);
  const showHrCandidatesFollowUp = canAccessHiringModule(user?.userRole);
  const roleNorm = String(user?.userRole || "").trim().toUpperCase();
  const isDigitalRole =
    roleNorm.includes("DIGITAL") || roleNorm.includes("MARKETER");
  const isEaRole = String(user?.userRole || "").trim() === "EA";

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <TodayReportButton variant="sales" />
        <LeaveApprovalButton variant="sales" />
        <ExpenseApprovalButton variant="sales" />
        {isDigitalRole && <DigitalMarketingQuickCards username={user.username} />}
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

      {isDigitalRole ? (
        <div className="space-y-5">
          <TopBacklinksKeywordsCards username={user.username} />
          <div className={`${salesCard} min-h-[280px]`}>
            <UpcomingTasks
              leadSource={user.username}
              compact
              variant="sales"
              dashboardPrefix="/digital-marketing-dashboard"
            />
          </div>
        </div>
      ) : (
        <>
          {/* Enquiry left, Tasks right */}
          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
            <div className={`${salesCard} min-h-[380px] xl:col-span-8`}>
              <UpcomingLeads
                leadSource={user.username}
                userRole={user.userRole}
                compact
                variant="sales"
                dashboardPrefix="/user-dashboard"
              />
            </div>
            <div className={`${salesCard} min-h-[280px] xl:col-span-4`}>
              <UpcomingTasks
                leadSource={user.username}
                compact
                variant="sales"
                dashboardPrefix="/user-dashboard"
              />
            </div>
          </div>

          {/* Upcoming Follow-ups - Hidden for EA role */}
          {!isEaRole && (
            <UpcomingFollowupsWidget
              username={user.username}
              userRole={user.userRole}
              variant="sales"
              dashboardPrefix="/user-dashboard"
            />
          )}
        </>
      )}

    </div>
  );
}
