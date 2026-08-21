import UpcomingTasks from "@/components/task/UpcomingTasks";
import UpcomingLeads from "@/components/Leads/UpcommingLeads";
import HrTargetVsCompletedChart from "@/components/empcrm/HrTargetVsCompletedChart";
import HiringCandidatesFollowUpSection from "@/components/empcrm/hiring/HiringCandidatesFollowUpSection";
import { canAccessHiringModule, canViewHrTargetChart } from "@/lib/hrTargetEligibleRoles";
import UpcomingFollowupsWidget from "@/components/service/UpcomingFollowupsWidget";

const salesCard =
  "flex min-h-0 flex-col rounded-xl border border-slate-100 bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_2px_4px_-2px_rgba(0,0,0,0.05)] md:p-5";

export default function HrDashboard({ user }) {
  const showHrTargetChart = canViewHrTargetChart(user?.userRole);
  const showHrCandidatesFollowUp = canAccessHiringModule(user?.userRole);

  return (
    <div className="space-y-4 md:space-y-5">
      {showHrTargetChart && (
        <div className={salesCard}>
          <HrTargetVsCompletedChart />
        </div>
      )}

      {showHrCandidatesFollowUp && (
        <div className={salesCard}>
          <HiringCandidatesFollowUpSection showOpenHiringLink />
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <div className={`${salesCard} min-h-[380px] xl:col-span-8`}>
          <UpcomingLeads
            leadSource={user.username}
            userRole={user.userRole}
            compact
            variant="sales"
            dashboardPrefix="/hr-dashboard"
          />
        </div>
        <div className={`${salesCard} min-h-[280px] xl:col-span-4`}>
          <UpcomingTasks
            leadSource={user.username}
            compact
            variant="sales"
            dashboardPrefix="/hr-dashboard"
          />
        </div>
      </div>

      <UpcomingFollowupsWidget
        username={user.username}
        userRole={user.userRole}
        variant="sales"
        dashboardPrefix="/hr-dashboard"
      />
    </div>
  );
}

