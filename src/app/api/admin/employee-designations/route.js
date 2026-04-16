import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import { dedupeDesignationStrings, omitBlockedDesignations } from "@/lib/designationDedupe";

/**
 * GET: distinct job designations from employee_profiles and candidates (for HR target dropdown).
 * Superadmin only — same access as hr-designation-targets.
 * Variants that differ only by case/spacing appear once (canonical label chosen).
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
      console.error("[admin/employee-designations] employee_profiles", e);
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
      /* candidates table optional */
    }

    const list = omitBlockedDesignations(dedupeDesignationStrings(raw));

    return NextResponse.json({ success: true, designations: list });
  } catch (error) {
    console.error("[admin/employee-designations]", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
