import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { canAccessHiringModule } from "@/lib/hrTargetEligibleRoles";

/**
 * GET — distinct designations from `hr_designation_monthly_targets` assigned to the logged-in HR (`hr_username`).
 * Used so hiring rows use the same designation strings as admin targets (no typo mismatch).
 */
export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessHiringModule(payload.role ?? payload.userRole)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const conn = await getDbConnection();

    let hasHrUsername = false;
    try {
      const [cols] = await conn.execute(
        `SHOW COLUMNS FROM hr_designation_monthly_targets LIKE 'hr_username'`
      );
      hasHrUsername = cols.length > 0;
    } catch {
      return NextResponse.json({ success: true, designations: [] });
    }

    if (!hasHrUsername) {
      return NextResponse.json({ success: true, designations: [] });
    }

    const [rows] = await conn.execute(
      `SELECT DISTINCT TRIM(designation) AS d
       FROM hr_designation_monthly_targets
       WHERE TRIM(COALESCE(designation, '')) <> ''
         AND LOWER(TRIM(COALESCE(hr_username, ''))) = LOWER(TRIM(?))
       ORDER BY d ASC`,
      [payload.username]
    );

    const designations = (rows || [])
      .map((r) => (r.d != null ? String(r.d).trim() : ""))
      .filter((s) => s !== "");

    return NextResponse.json({ success: true, designations });
  } catch (error) {
    console.error("[empcrm/hiring-admin-designations GET]", error);
    const msg = String(error?.message || "");
    if (msg.includes("hr_designation_monthly_targets") || msg.includes("doesn't exist")) {
      return NextResponse.json({ success: true, designations: [] });
    }
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
