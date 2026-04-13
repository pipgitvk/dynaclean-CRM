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

/** GET ?entryId= — status / note timeline for one hiring row (own rows only) */
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    const denied = assertHrRole(payload);
    if (denied) return denied;

    const entryId = parseInt(new URL(req.url).searchParams.get("entryId") ?? "", 10);
    if (!Number.isFinite(entryId) || entryId < 1) {
      return NextResponse.json({ success: false, error: "Valid entryId is required." }, { status: 400 });
    }

    const conn = await getDbConnection();
    const [entryRows] = await conn.execute(
      `SELECT id, created_by_username, candidate_name, designation, status, note, created_at
       FROM hr_hiring_entries
       WHERE id = ? AND LOWER(TRIM(created_by_username)) = LOWER(TRIM(?))`,
      [entryId, payload.username]
    );
    if (!entryRows.length) {
      return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });
    }

    const [history] = await conn.execute(
      `SELECT id, status_before, status_after, actor_username, note, logged_at
       FROM hr_hiring_entry_status_history
       WHERE entry_id = ?
       ORDER BY logged_at ASC, id ASC`,
      [entryId]
    );

    return NextResponse.json({
      success: true,
      entry: entryRows[0],
      history: history,
    });
  } catch (error) {
    console.error("[empcrm/hiring/history GET]", error);
    const msg = error?.message || "";
    if (msg.includes("hr_hiring_entry_status_history") && (msg.includes("doesn't exist") || msg.includes("Unknown table"))) {
      return NextResponse.json(
        {
          success: false,
          error:
            "History table missing. Run admin-dashboard/hiring-process/migration_hr_hiring_status_history.sql",
        },
        { status: 503 }
      );
    }
    if (msg.includes("Unknown column") && msg.includes("note")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "History note column missing. Run admin-dashboard/hiring-process/migration_hr_hiring_status_history_note.sql",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
