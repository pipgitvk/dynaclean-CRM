// components/Dashboards/SalesDashboard.jsx

import UpcomingTasks from "@/components/task/UpcomingTasks";
import UpcomingLeads from "@/components/Leads/UpcommingLeads";
import HotLeadsCards from "@/components/Leads/HotLeadsCards";
import FastCardButton from "@/components/FastCardButton";
import TodayReportButton from "@/components/TodayReportButton";
import TodaysReportingButton from "@/components/TodaysReportingButton";
import PaymentPendingButton from "@/components/PaymentPendingCircle";
import SalesAchievedQuickCard from "@/components/targets/SalesAchievedQuickCard";
import ScheduleVisitCard from "@/components/scheduleVisit/ScheduleVisitCard";

const salesCard =
  "flex min-h-0 flex-col rounded-xl border border-slate-100 bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_2px_4px_-2px_rgba(0,0,0,0.05)] md:p-5";

export default function SalesDashboard({ user }) {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      {/* Top stats — full width */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <TodaysReportingButton variant="sales" />
        <PaymentPendingButton variant="sales" monthly />
        <TodayReportButton variant="sales" />
        <ScheduleVisitCard variant="sales" href="/sales-dashboard/schedule-visits" />
        <FastCardButton
          variant="sales"
          monthly
          type="customers"
          label="Good Customers"
          iconName="Users"
          href="/sales-dashboard/customers"
          iconColor="border-green-200"
        />
        <FastCardButton
          variant="sales"
          monthly
          type="sales"
          label="Sales"
          iconName="TrendingUp"
          href="/sales-dashboard/order"
          iconColor="border-purple-200"
        />
        <SalesAchievedQuickCard />
      </div>

      {/* Main + right sidebar layout */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        {/* Left: Upcoming Enquiry */}
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          <div className={`${salesCard} min-h-[380px]`}>
            <UpcomingLeads
              leadSource={user.username}
              userRole={user.userRole}
              compact
              variant="sales"
              dashboardPrefix="/sales-dashboard"
            />
          </div>
        </div>

        {/* Right: Hot Leads + Tasks */}
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-4">
          <div className={`${salesCard} min-h-[320px]`}>
            <HotLeadsCards
              leadSource={user.username}
              compact
              dashboardPrefix="/sales-dashboard"
            />
          </div>

          <div className={`${salesCard} min-h-[280px]`}>
            <UpcomingTasks
              leadSource={user.username}
              compact
              variant="sales"
              dashboardPrefix="/sales-dashboard"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
