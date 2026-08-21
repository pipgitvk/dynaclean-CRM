import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getEmployeeAttendanceSchedule } from "@/lib/employeeAttendanceSchedule";

/** GET — logged-in user's schedule from employee_attendance_schedule */
export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { rules, source } = await getEmployeeAttendanceSchedule(
      payload.username
    );

    return NextResponse.json({
      rules,
      source,
      table: "employee_attendance_schedule",
    });
  } catch (error) {
    console.error("attendance/my-rules GET:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
