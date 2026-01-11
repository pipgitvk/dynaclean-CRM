// components/Dashboards/ServiceHeadDashboard.jsx

import ProfilePicUploader from "@/app/user-dashboard/ProfilePicUploader";
import AttendanceTracker from "@/components/AttendanceTracker";
import UpcomingTasks from "@/components/task/UpcomingTasks";
import InfoBox from "@/components/InfoBox";

export default function ServiceHeadDashboard({ user, counts }) {
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-4 md:p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <ProfilePicUploader user={user} />
            <div className="space-y-1">
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

        {/* <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <h2 className="text-lg mb-2 font-semibold text-gray-700">
            Quick Stats
          </h2>
          <p className="text-sm text-gray-500">
            Overview of service performance
          </p>
        </div> */}
      </div>

      {/* Stats Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <InfoBox
          title="Completed"
          number={counts.completed}
          url="/user-dashboard/view_service_reports"
          bgColor="#10b981"
        />

        <InfoBox
          title="Pending"
          number={counts.pending}
          url="/user-dashboard/view_service_reports"
          bgColor="#ef4444"
        />

        <InfoBox
          title="Pending For Spares"
          number={counts.pendingSpares}
          url="/user-dashboard/view_service_reports"
          bgColor="#e08719"
        />
      </div>

      {/* Tasks Section */}
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          Upcoming Tasks
        </h2>
        <UpcomingTasks leadSource={user.username} />
      </div>
    </div>
  );
}
