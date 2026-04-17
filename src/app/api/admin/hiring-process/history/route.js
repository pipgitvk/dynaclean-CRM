import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";

function assertSuperadmin(payload) {
  if (!payload?.username) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (normalizeRoleKey(payload.role ?? payload.userRole) !== "SUPERADMIN") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** GET ?entryId= — status change timeline for one hiring row */
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    const denied = assertSuperadmin(payload);
    if (denied) return denied;

    const entryId = parseInt(new URL(req.url).searchParams.get("entryId") ?? "", 10);
    if (!Number.isFinite(entryId) || entryId < 1) {
      return NextResponse.json({ success: false, error: "Valid entryId is required." }, { status: 400 });
    }

    const conn = await getDbConnection();
    const [entryRows] = await conn.execute(
      `SELECT c.id, c.created_by,
       COALESCE(ep.full_name, c.created_by) AS creator_name,
       ep.designation AS creator_role,
       c.candidate_name, c.emp_contact, c.designation, c.marital_status, c.experience_type,
       c.interview_at, c.rescheduled_at, c.next_followup_at, c.interview_mode,
       c.status, c.hr_interview_score, c.current_salary, c.expected_salary, c.note, c.created_at
       FROM candidates c
       LEFT JOIN employee_profiles ep ON LOWER(TRIM(ep.username)) = LOWER(TRIM(c.created_by))
       WHERE c.id = ?`,
      [entryId]
    );
    if (!entryRows.length) {
      return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });
    }

    const [history] = await conn.execute(
      `SELECT h.id, h.\`status\`, h.updated_by,
       COALESCE(ep.full_name, h.updated_by) AS updater_name,
       ep.designation AS updater_role,
       h.note, h.logged_at
       FROM candidates_followups h
       LEFT JOIN employee_profiles ep ON LOWER(TRIM(ep.username)) = LOWER(TRIM(h.updated_by))
       WHERE h.entry_id = ?
       ORDER BY h.logged_at ASC, h.id ASC`,
      [entryId]
    );

    return NextResponse.json({
      success: true,
      entry: entryRows[0],
      history: history,
    });
  } catch (error) {
    console.error("[admin/hiring-process/history GET]", error);
    const msg = error?.message || "";
    if (msg.includes("candidates_followups") && (msg.includes("doesn't exist") || msg.includes("Unknown table"))) {
      return NextResponse.json(
        {
          success: false,
          error:
            "History table missing. Run admin-dashboard/hiring-process/migration_hr_hiring_status_history.sql",
        },
        { status: 503 }
      );
    }
    if (msg.includes("Unknown column") && (msg.includes("'status'") || msg.includes("`status`"))) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Run migration: empcrm/admin-dashboard/hiring/migration_candidates_followups_status_only.sql",
        },
        { status: 503 }
      );
    }
    if (msg.includes("Unknown column") && (msg.includes("'updated_by'") || msg.includes("`updated_by`"))) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Run migration: empcrm/admin-dashboard/hiring/migration_candidates_followups_actor_to_updated_by.sql",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
