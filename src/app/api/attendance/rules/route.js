import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getEmployeeAttendanceSchedule } from "@/lib/employeeAttendanceSchedule";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

/** GET — tea/lunch/evening break times from employee_attendance_schedule */
export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get("impersonation_token")?.value ||
      cookieStore.get("token")?.value;

    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    const { searchParams } = new URL(req.url);
    const username =
      searchParams.get("username") || payload.username || null;

    if (!username) {
      return Response.json({ error: "Username required" }, { status: 400 });
    }

    const { rules, source } = await getEmployeeAttendanceSchedule(username);

    return Response.json({ rules, source, table: "employee_attendance_schedule" });
  } catch (error) {
    console.error("Error fetching attendance rules:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
