import { redirect } from "next/navigation";

export default function EmployeeAttendanceScheduleRedirectPage() {
  redirect("/admin-dashboard/attendance-rules");
}
