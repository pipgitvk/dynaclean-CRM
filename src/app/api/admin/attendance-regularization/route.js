import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getMainSessionPayload } from "@/lib/auth";
import {
  canManageAttendanceRules,
  resolveRoleForAttendanceAdmin,
} from "@/lib/adminAttendanceRulesAuth";

/**
 * List all attendance regularization requests (admin / HR).
 */
export async function GET() {
  try {
    const payload = await getMainSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const role = await resolveRoleForAttendanceAdmin(payload);
    if (!canManageAttendanceRules(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT *
       FROM attendance_regularization_requests
       ORDER BY created_at DESC
       LIMIT 2000`
    );

    return NextResponse.json({ success: true, requests: rows });
  } catch (error) {
    console.error("admin attendance-regularization GET:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
