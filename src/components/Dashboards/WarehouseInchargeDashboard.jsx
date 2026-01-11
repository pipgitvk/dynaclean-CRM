// components/Dashboards/WarehouseInchargeDashboard.jsx
import Link from "next/link";
// import ProfilePicUploader from "@/app/user-dashboard/ProfilePicUploader";
// import AttendanceTracker from "@/components/AttendanceTracker";
import UpcomingTasks from "@/components/task/UpcomingTasks";

export default function WarehouseInchargeDashboard({ user, counts }) {
  return (
    <div className="space-y-4 md:space-y-6">

      

      {/* Pending Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">

        <Link href="/user-dashboard/order">
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 cursor-pointer">
            <h2 className="text-lg font-semibold">Dispatch Pendings</h2>
            <p className="text-4xl font-bold text-blue-600">{counts.dispatch}</p>
          </div>
        </Link>

        <Link href="/user-dashboard/spare/purchase/warehouse-in">
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 cursor-pointer">
            <h2 className="text-lg font-semibold">Spare IN Pendings</h2>
            <p className="text-4xl font-bold text-orange-500">{counts.spare}</p>
          </div>
        </Link>

        <Link href="/user-dashboard/purchase/warehouse-in">
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 cursor-pointer">
            <h2 className="text-lg font-semibold">Products IN Pendings</h2>
            <p className="text-4xl font-bold text-purple-600">
              {counts.products}
            </p>
          </div>
        </Link>

      </div>

      {/* Tasks */}
      <div className="bg-white rounded-xl shadow-md">
        <UpcomingTasks leadSource={user.username} />
      </div>

    </div>
  );
}
