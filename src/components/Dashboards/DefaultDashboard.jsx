// components/Dashboards/DefaultDashboard.jsx
import ProfilePicUploader from "@/app/user-dashboard/ProfilePicUploader";
import AttendanceTracker from "@/components/AttendanceTracker";
import UpcomingTasks from "@/components/task/UpcomingTasks";
import UpcomingLeads from "@/components/Leads/UpcommingLeads";

export default function DefaultDashboard({ user }) {
  return (
    <div className="space-y-4 md:space-y-6">

      {/* Welcome + Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

        <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-4 md:p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <ProfilePicUploader user={user} />
            <div>
              <h1 className="text-3xl font-semibold">
                Welcome, <span className="text-green-700">{user.username}</span>
              </h1>
              <p className="text-sm text-gray-500">Role: {user.userRole}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <AttendanceTracker username={user.username} />
        </div>

      </div>

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
