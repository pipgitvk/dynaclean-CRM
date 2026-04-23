import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { canAccessHiringModule } from "@/lib/hrTargetEligibleRoles";

function assertHrRole(payload) {
  if (!payload?.username) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessHiringModule(payload.role ?? payload.userRole)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}

async function hasCityColumn(conn) {
  const [rows] = await conn.execute(`SHOW COLUMNS FROM hr_designation_monthly_targets LIKE 'city'`);
  return rows.length > 0;
}

async function hasHrUsernameColumn(conn) {
  const [rows] = await conn.execute(`SHOW COLUMNS FROM hr_designation_monthly_targets LIKE 'hr_username'`);
  return rows.length > 0;
}

/**
 * GET ?designation=
 * Distinct `city` values from `hr_designation_monthly_targets` for the chosen designation
 * and the logged-in HR (when `hr_username` exists) — same source as superadmin target setup.
 */
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    const denied = assertHrRole(payload);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const designation = String(searchParams.get("designation") ?? "").trim();
    if (!designation) {
      return NextResponse.json({ success: true, cities: [] });
    }

    const conn = await getDbConnection();
    const withCity = await hasCityColumn(conn);
    if (!withCity) {
      return NextResponse.json({ success: true, cities: [] });
    }

    const withHrUsername = await hasHrUsernameColumn(conn);
    const uname = String(payload.username ?? "").trim();

    let rows;
    if (withHrUsername) {
      [rows] = await conn.execute(
        `SELECT DISTINCT TRIM(city) AS c
         FROM hr_designation_monthly_targets
         WHERE LOWER(TRIM(designation)) = LOWER(TRIM(?))
           AND LOWER(TRIM(COALESCE(hr_username, ''))) = LOWER(TRIM(?))
           AND TRIM(COALESCE(city, '')) <> ''
         ORDER BY c ASC`,
        [designation, uname]
      );
    } else {
      [rows] = await conn.execute(
        `SELECT DISTINCT TRIM(city) AS c
         FROM hr_designation_monthly_targets
         WHERE LOWER(TRIM(designation)) = LOWER(TRIM(?))
           AND TRIM(COALESCE(city, '')) <> ''
         ORDER BY c ASC`,
        [designation]
      );
    }

    const cities = (rows || [])
      .map((r) => (r.c != null ? String(r.c).trim() : ""))
      .filter((s) => s !== "");

    return NextResponse.json({ success: true, cities });
  } catch (error) {
    console.error("[empcrm/hiring-cities-for-designation]", error);
    const msg = String(error?.message || "");
    if (msg.includes("hr_designation_monthly_targets") || msg.includes("doesn't exist")) {
      return NextResponse.json({ success: true, cities: [] });
    }
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
