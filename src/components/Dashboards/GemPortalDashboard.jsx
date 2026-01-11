// components/Dashboards/GemPortalDashboard.jsx
import ProfilePicUploader from "@/app/user-dashboard/ProfilePicUploader";
import AttendanceTracker from "@/components/AttendanceTracker";
import EmployeeTargetGraph from "@/components/targets/EmployeeTargetGraph";
import UpcomingTasks from "@/components/task/UpcomingTasks";
import UpcomingLeads from "@/components/Leads/UpcommingLeads";

export default function GemPortalDashboard({ user }) {
  return (
    <div className="space-y-4 md:space-y-6">

      {/* Welcome, Attendance & Target */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">

        <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-4 md:p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <ProfilePicUploader user={user} />
            <div className="space-y-2 flex-1">
              <h1 className="text-3xl font-semibold">
                Welcome, <span className="text-green-700">{user.username}</span>
              </h1>
              <p className="text-gray-500 text-sm">Role: {user.userRole}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <AttendanceTracker username={user.username} />
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <EmployeeTargetGraph />
        </div>

      </div>

      {/* Leads + Tasks */}
      <div className="grid grid-cols-1 gap-4 md:gap-6">
        <div className="bg-white rounded-xl shadow-md">
          <UpcomingLeads leadSource={user.username} />
        </div>

        <div className="bg-white rounded-xl shadow-md">
          <UpcomingTasks leadSource={user.username} />
        </div>
      </div>

    </div>
  );
}
