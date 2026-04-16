import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { canAccessHiringModule } from "@/lib/hrTargetEligibleRoles";
import { dedupeDesignationStrings, omitBlockedDesignations } from "@/lib/designationDedupe";

function assertHrRole(payload) {
  if (!payload?.username) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessHiringModule(payload.role ?? payload.userRole)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * GET: same deduped designation list as /api/admin/employee-designations (profiles + candidates),
 * for HR hiring forms. Requires HR hiring module access.
 */
export async function GET() {
  try {
    const payload = await getSessionPayload();
    const denied = assertHrRole(payload);
    if (denied) return denied;

    const conn = await getDbConnection();
    const raw = [];

    try {
      const [epRows] = await conn.execute(
        `SELECT DISTINCT TRIM(designation) AS d
         FROM employee_profiles
         WHERE TRIM(COALESCE(designation, '')) != ''`
      );
      for (const r of epRows || []) {
        const d = String(r.d ?? "").trim();
        if (d) raw.push(d);
      }
    } catch (e) {
      console.error("[empcrm/hiring-designations] employee_profiles", e);
    }

    try {
      const [cRows] = await conn.execute(
        `SELECT DISTINCT TRIM(designation) AS d
         FROM candidates
         WHERE TRIM(COALESCE(designation, '')) != ''`
      );
      for (const r of cRows || []) {
        const d = String(r.d ?? "").trim();
        if (d) raw.push(d);
      }
    } catch {
      /* candidates optional */
    }

    const designations = omitBlockedDesignations(dedupeDesignationStrings(raw));
    return NextResponse.json({ success: true, designations });
  } catch (error) {
    console.error("[empcrm/hiring-designations]", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
