import ScheduleVisitsClient from "@/components/scheduleVisit/ScheduleVisitsClient";

export default function SalesScheduleVisitsPage() {
  return (
    <div className="px-4 py-6 max-w-full">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Schedule Visits</h1>
      <ScheduleVisitsClient dashboardPrefix="user-dashboard" />
    </div>
  );
}
