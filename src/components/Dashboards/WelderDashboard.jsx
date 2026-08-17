import ProfilePicUploader from "@/app/user-dashboard/ProfilePicUploader";
import AttendanceTracker from "@/components/AttendanceTracker";

export default function WelderDashboard({ user, reportingManager }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
      <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <ProfilePicUploader user={user} />
          <div className="space-y-2 flex-1">
            <h1 className="text-3xl font-semibold">
              Welcome, <span className="text-green-700">{user.username}</span>
            </h1>
            <p className="text-gray-500 text-sm">Role: {user.userRole}</p>
            {reportingManager && (
              <p className="text-gray-500 text-sm">
                Reporting Manager: {reportingManager}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 md:p-6 min-w-0">
        <AttendanceTracker username={user.username} role={user.userRole} />
      </div>
    </div>
  );
}
