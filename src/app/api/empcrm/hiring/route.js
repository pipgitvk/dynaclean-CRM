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

/** GET ?year=&month= optional filter */
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    const denied = assertHrRole(payload);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    const conn = await getDbConnection();
    let sql = `SELECT id, candidate_name, designation, hire_date, note, created_at
               FROM hr_hiring_entries WHERE LOWER(TRIM(created_by_username)) = LOWER(TRIM(?))`;
    const params = [payload.username];
    if (year != null && year !== "") {
      sql += ` AND YEAR(hire_date) = ?`;
      params.push(parseInt(year, 10));
    }
    if (month != null && month !== "") {
      sql += ` AND MONTH(hire_date) = ?`;
      params.push(parseInt(month, 10));
    }
    sql += ` ORDER BY hire_date DESC, id DESC`;

    const [rows] = await conn.execute(sql, params);
    return NextResponse.json({ success: true, entries: rows });
  } catch (error) {
    console.error("[empcrm/hiring GET]", error);
    const msg = error?.message || "";
    if (msg.includes("hr_hiring_entries") && msg.includes("doesn't exist")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Table missing. Run migration: empcrm/admin-dashboard/hiring/migration_hr_hiring_entries.sql",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    const denied = assertHrRole(payload);
    if (denied) return denied;

    const body = await request.json();
    const candidate_name = String(body.candidate_name ?? "").trim();
    const designation = String(body.designation ?? "").trim();
    const hire_date = String(body.hire_date ?? "").trim();
    const note = String(body.note ?? "").trim() || null;

    if (!candidate_name || !designation || !hire_date) {
      return NextResponse.json(
        { success: false, error: "Candidate name, designation, and hire date are required." },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    await conn.execute(
      `INSERT INTO hr_hiring_entries (created_by_username, candidate_name, designation, hire_date, note)
       VALUES (?, ?, ?, ?, ?)`,
      [payload.username, candidate_name, designation, hire_date, note]
    );

    return NextResponse.json({ success: true, message: "Hire recorded." });
  } catch (error) {
    console.error("[empcrm/hiring POST]", error);
    const msg = error?.message || "";
    if (msg.includes("hr_hiring_entries") && msg.includes("doesn't exist")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Table missing. Run migration: empcrm/admin-dashboard/hiring/migration_hr_hiring_entries.sql",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: error.message || "Server error" }, { status: 500 });
  }
}

/** DELETE ?id= own row only */
export async function DELETE(req) {
  try {
    const payload = await getSessionPayload();
    const denied = assertHrRole(payload);
    if (denied) return denied;

    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const [r] = await conn.execute(
      `DELETE FROM hr_hiring_entries WHERE id = ? AND LOWER(TRIM(created_by_username)) = LOWER(TRIM(?))`,
      [parseInt(id, 10), payload.username]
    );
    return NextResponse.json({ success: true, deleted: r.affectedRows || 0 });
  } catch (error) {
    console.error("[empcrm/hiring DELETE]", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
