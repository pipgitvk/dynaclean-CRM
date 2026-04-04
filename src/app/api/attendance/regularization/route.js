import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  getReportees,
  isReportingManagerOf,
  getReportingManagerForEmployee,
} from "@/lib/reportingManager";

const COLS = [
  "checkin_time",
  "checkout_time",
  "break_morning_start",
  "break_morning_end",
  "break_lunch_start",
  "break_lunch_end",
  "break_evening_start",
  "break_evening_end",
];

function mapRowToProposed(row) {
  const o = {};
  for (const c of COLS) {
    o[c] = row[c] ?? null;
  }
  return o;
}

/** @param {string|null|undefined} v */
function normalizeMysqlDatetime(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (s.length === 16 && s.includes("T")) return `${s.replace("T", " ")}:00`;
  if (s.length === 16 && s.includes(" ")) return `${s}:00`;
  return s;
}

export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "summary";

    const conn = await getDbConnection();

    if (scope === "summary") {
      const reportees = await getReportees(session.username);
      const isReportingManager = reportees.length > 0;
      let managerPendingCount = 0;
      if (isReportingManager) {
        const ph = reportees.map(() => "?").join(", ");
        const [r] = await conn.execute(
          `SELECT COUNT(*) AS c FROM attendance_regularization_requests
           WHERE status = 'pending' AND username IN (${ph})`,
          reportees
        );
        managerPendingCount = Number(r[0]?.c) || 0;
      }
      const [m] = await conn.execute(
        `SELECT COUNT(*) AS c FROM attendance_regularization_requests
         WHERE status = 'pending' AND username = ?`,
        [session.username]
      );
      return NextResponse.json({
        success: true,
        isReportingManager,
        managerPendingCount,
        myPendingCount: Number(m[0]?.c) || 0,
      });
    }

    if (scope === "mine") {
      const [rows] = await conn.execute(
        `SELECT * FROM attendance_regularization_requests
         WHERE username = ? ORDER BY created_at DESC LIMIT 200`,
        [session.username]
      );
      return NextResponse.json({ success: true, requests: rows });
    }

    if (scope === "pending-approvals") {
      const reportees = await getReportees(session.username);
      if (reportees.length === 0) {
        return NextResponse.json({ success: true, requests: [] });
      }
      const ph = reportees.map(() => "?").join(", ");
      const [rows] = await conn.execute(
        `SELECT * FROM attendance_regularization_requests
         WHERE status = 'pending' AND username IN (${ph})
         ORDER BY created_at ASC`,
        reportees
      );
      return NextResponse.json({ success: true, requests: rows });
    }

    return NextResponse.json({ success: false, error: "Invalid scope" }, { status: 400 });
  } catch (error) {
    console.error("attendance regularization GET:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { log_date, reason, proposed } = body;

    if (!log_date || typeof log_date !== "string") {
      return NextResponse.json(
        { success: false, error: "log_date is required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const manager = await getReportingManagerForEmployee(session.username);
    if (!manager) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No reporting manager is set for your account. Ask HR to assign a reporting manager in Employees.",
        },
        { status: 400 }
      );
    }

    if (!proposed || typeof proposed !== "object") {
      return NextResponse.json(
        { success: false, error: "proposed times object is required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    const [pendingDup] = await conn.execute(
      `SELECT id FROM attendance_regularization_requests
       WHERE username = ? AND log_date = ? AND status = 'pending' LIMIT 1`,
      [session.username, log_date]
    );
    if (pendingDup.length > 0) {
      return NextResponse.json(
        { success: false, error: "You already have a pending regularization for this date." },
        { status: 409 }
      );
    }

    const [logs] = await conn.execute(
      `SELECT * FROM attendance_logs WHERE username = ? AND date = ? LIMIT 1`,
      [session.username, log_date]
    );
    if (logs.length === 0) {
      return NextResponse.json(
        { success: false, error: "No attendance log found for that date." },
        { status: 404 }
      );
    }

    const logRow = logs[0];
    const orig = mapRowToProposed(logRow);

    const prop = {};
    for (const c of COLS) {
      prop[c] = normalizeMysqlDatetime(proposed[c] ?? null);
    }

    await conn.execute(
      `INSERT INTO attendance_regularization_requests (
        username, log_date, status, reason,
        original_checkin_time, original_checkout_time,
        original_break_morning_start, original_break_morning_end,
        original_break_lunch_start, original_break_lunch_end,
        original_break_evening_start, original_break_evening_end,
        proposed_checkin_time, proposed_checkout_time,
        proposed_break_morning_start, proposed_break_morning_end,
        proposed_break_lunch_start, proposed_break_lunch_end,
        proposed_break_evening_start, proposed_break_evening_end
      ) VALUES (?, ?, 'pending', ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.username,
        log_date,
        reason && String(reason).trim() ? String(reason).trim() : null,
        orig.checkin_time,
        orig.checkout_time,
        orig.break_morning_start,
        orig.break_morning_end,
        orig.break_lunch_start,
        orig.break_lunch_end,
        orig.break_evening_start,
        orig.break_evening_end,
        prop.checkin_time,
        prop.checkout_time,
        prop.break_morning_start,
        prop.break_morning_end,
        prop.break_lunch_start,
        prop.break_lunch_end,
        prop.break_evening_start,
        prop.break_evening_end,
      ]
    );

    return NextResponse.json({ success: true, message: "Submitted to your reporting manager for approval." });
  } catch (error) {
    console.error("attendance regularization POST:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, action, reviewer_comment } = body;

    if (!id || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "id and action (approve|reject) are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    const [reqRows] = await conn.execute(
      `SELECT * FROM attendance_regularization_requests WHERE id = ? LIMIT 1`,
      [id]
    );
    if (reqRows.length === 0) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }

    const reqRow = reqRows[0];
    if (reqRow.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "This request is no longer pending." },
        { status: 409 }
      );
    }

    const allowed = await isReportingManagerOf(session.username, reqRow.username);
    if (!allowed) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const comment =
      reviewer_comment && String(reviewer_comment).trim()
        ? String(reviewer_comment).trim()
        : null;

    if (action === "reject") {
      await conn.execute(
        `UPDATE attendance_regularization_requests SET
          status = 'rejected',
          reviewed_by = ?,
          reviewed_at = NOW(),
          reviewer_comment = ?
         WHERE id = ?`,
        [session.username, comment, id]
      );
      return NextResponse.json({ success: true, message: "Request rejected." });
    }

    const [logRows] = await conn.execute(
      `SELECT * FROM attendance_logs WHERE username = ? AND date = ? LIMIT 1`,
      [reqRow.username, reqRow.log_date]
    );
    if (logRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Attendance log no longer exists for that date." },
        { status: 404 }
      );
    }

    const logRow = logRows[0];
    let checkoutLat = logRow.checkout_latitude;
    let checkoutLon = logRow.checkout_longitude;
    let checkoutAddr = logRow.checkout_address;
    if (reqRow.proposed_checkout_time && (checkoutLat == null || checkoutLon == null)) {
      checkoutLat = checkoutLat ?? 0;
      checkoutLon = checkoutLon ?? 0;
      checkoutAddr = checkoutAddr || "Manager-approved regularization";
    }

    await conn.execute(
      `UPDATE attendance_logs SET
        checkin_time = ?,
        checkout_time = ?,
        break_morning_start = ?,
        break_morning_end = ?,
        break_lunch_start = ?,
        break_lunch_end = ?,
        break_evening_start = ?,
        break_evening_end = ?,
        checkout_latitude = ?,
        checkout_longitude = ?,
        checkout_address = ?
       WHERE username = ? AND date = ?`,
      [
        reqRow.proposed_checkin_time,
        reqRow.proposed_checkout_time,
        reqRow.proposed_break_morning_start,
        reqRow.proposed_break_morning_end,
        reqRow.proposed_break_lunch_start,
        reqRow.proposed_break_lunch_end,
        reqRow.proposed_break_evening_start,
        reqRow.proposed_break_evening_end,
        checkoutLat,
        checkoutLon,
        checkoutAddr,
        reqRow.username,
        reqRow.log_date,
      ]
    );

    await conn.execute(
      `UPDATE attendance_regularization_requests SET
        status = 'approved',
        reviewed_by = ?,
        reviewed_at = NOW(),
        reviewer_comment = ?
       WHERE id = ?`,
      [session.username, comment, id]
    );

    return NextResponse.json({ success: true, message: "Attendance updated." });
  } catch (error) {
    console.error("attendance regularization PATCH:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
