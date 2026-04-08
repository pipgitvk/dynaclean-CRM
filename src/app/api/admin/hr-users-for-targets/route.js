import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import { isHrTargetDashboardRole } from "@/lib/hrTargetEligibleRoles";

/**
 * GET: list active rep_list users whose role is HR / HR HEAD / HR Executive — for Superadmin target dropdown.
 */
export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (normalizeRoleKey(payload.role ?? payload.userRole) !== "SUPERADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT
         rl.username,
         rl.userRole,
         COALESCE(NULLIF(TRIM(ep.full_name), ''), rl.username) AS display_name,
         TRIM(COALESCE(NULLIF(ep.designation, ''), NULLIF(rl.userDepartment, ''), '')) AS suggested_designation
       FROM rep_list rl
       LEFT JOIN employee_profiles ep ON LOWER(TRIM(ep.username)) = LOWER(TRIM(rl.username))
       WHERE rl.status = 1
       ORDER BY rl.username ASC`
    );

    const users = (rows || []).filter((r) => isHrTargetDashboardRole(r.userRole));

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("[hr-users-for-targets]", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
