import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getMainSessionPayload } from "@/lib/auth";
import {
  canManageAttendanceRules,
  resolveRoleForAttendanceAdmin,
} from "@/lib/adminAttendanceRulesAuth";

/**
 * Active employees from `rep_list` — same source as /admin-dashboard/employees (status = 1).
 */
export async function GET() {
  try {
    const payload = await getMainSessionPayload();
    if (!payload?.username) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const role = await resolveRoleForAttendanceAdmin(payload);
    if (!canManageAttendanceRules(role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const db = await getDbConnection();
    const [rows] = await db.query(
      `SELECT username, email, userRole, empId, status
       FROM rep_list
       WHERE status = 1
       ORDER BY username ASC`
    );

    return NextResponse.json({ employees: rows });
  } catch (error) {
    console.error("admin employees-active GET:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
