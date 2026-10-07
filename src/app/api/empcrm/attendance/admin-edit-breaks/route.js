import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  ATTENDANCE_EDIT_TRACKED_FIELDS,
  ADMIN_EDIT_ATTENDANCE_ADDRESS,
  diffAttendanceEditFields,
  recordAttendanceEditHistory,
} from "@/lib/attendanceEditHistory";
import { ensureAttendanceCheckoutGpsTriggersAllowAdmin } from "@/lib/ensureAttendanceCheckoutGpsTriggers";

const HR_ATTENDANCE_ROLES = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"];

const EDITABLE_TIME_COLUMNS = [
  "checkin_time",
  "checkout_time",
  "break_morning_start",
  "break_morning_end",
  "break_lunch_start",
  "break_lunch_end",
  "break_evening_start",
  "break_evening_end",
];

function isHrRole(role) {
  return role != null && HR_ATTENDANCE_ROLES.includes(String(role));
}

/** Accepts YYYY-MM-DD HH:mm:ss (IST wall clock stored in DB). */
function normalizeMysqlDatetime(s) {
  if (s == null || String(s).trim() === "") return null;
  const t = String(s).trim();
  const m = t.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!m) return null;
  const hh = String(parseInt(m[4], 10)).padStart(2, "0");
  const mm = String(parseInt(m[5], 10)).padStart(2, "0");
  const ss = m[6] != null ? String(parseInt(m[6], 10)).padStart(2, "0") : "00";
  return `${m[1]}-${m[2]}-${m[3]} ${hh}:${mm}:${ss}`;
}

/**
 * PATCH — admin edits check-in/out and break times for one attendance row.
 * Body: { username, date: "YYYY-MM-DD", ...time columns as datetime string or null }
 */
export async function PATCH(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }
    if (!isHrRole(payload.role)) {
      return NextResponse.json(
        { message: "Only HR / SUPERADMIN can edit attendance times." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const username = body.username != null ? String(body.username).trim() : "";
    const dateStr = body.date != null ? String(body.date).trim() : "";
    if (!username || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json(
        { message: "username and date (YYYY-MM-DD) are required." },
        { status: 400 }
      );
    }

    const afterValues = {};
    const assignments = [];
    const params = [];
    for (const col of EDITABLE_TIME_COLUMNS) {
      if (!Object.prototype.hasOwnProperty.call(body, col)) {
        return NextResponse.json(
          { message: `Missing field: ${col}` },
          { status: 400 }
        );
      }
      const raw = body[col];
      if (raw === null || raw === "") {
        afterValues[col] = null;
        assignments.push(`${col} = NULL`);
      } else {
        const normalized = normalizeMysqlDatetime(raw);
        if (!normalized) {
          return NextResponse.json(
            { message: `Invalid datetime for ${col}` },
            { status: 400 }
          );
        }
        afterValues[col] = normalized;
        assignments.push(`${col} = ?`);
        params.push(normalized);
      }
    }

    const conn = await getDbConnection();
    await ensureAttendanceCheckoutGpsTriggersAllowAdmin(conn);
    const cols = ATTENDANCE_EDIT_TRACKED_FIELDS.join(", ");
    const [beforeRows] = await conn.execute(
      `SELECT ${cols},
              checkin_latitude, checkin_longitude, checkin_address,
              checkout_latitude, checkout_longitude, checkout_address
       FROM attendance_logs WHERE username = ? AND date = ? LIMIT 1`,
      [username, dateStr]
    );
    if (!beforeRows.length) {
      return NextResponse.json(
        { message: "No attendance record for that user and date." },
        { status: 404 }
      );
    }

    const changes = diffAttendanceEditFields(beforeRows[0], afterValues);
    const checkinTimeEdited = changes.some((c) => c.field === "checkin_time");
    const checkoutTimeEdited = changes.some((c) => c.field === "checkout_time");
    const editedBy =
      payload.username || payload.name || payload.email || String(payload.sub || "unknown");

    if (checkinTimeEdited) {
      if (afterValues.checkin_time == null) {
        assignments.push(
          "checkin_latitude = NULL",
          "checkin_longitude = NULL",
          "checkin_address = NULL"
        );
      } else {
        assignments.push(
          "checkin_latitude = NULL",
          "checkin_longitude = NULL",
          "checkin_address = ?"
        );
        params.push(ADMIN_EDIT_ATTENDANCE_ADDRESS);
      }
    }

    if (checkoutTimeEdited) {
      if (afterValues.checkout_time == null) {
        assignments.push(
          "checkout_latitude = NULL",
          "checkout_longitude = NULL",
          "checkout_address = NULL"
        );
      } else {
        assignments.push(
          "checkout_latitude = NULL",
          "checkout_longitude = NULL",
          "checkout_address = ?"
        );
        params.push(ADMIN_EDIT_ATTENDANCE_ADDRESS);
      }
    }

    const sql = `UPDATE attendance_logs SET ${assignments.join(", ")} WHERE username = ? AND date = ?`;
    await conn.execute(sql, [...params, username, dateStr]);

    await recordAttendanceEditHistory(conn, {
      username,
      logDate: dateStr,
      editedBy,
      source: "admin_times_modal",
      changes,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("admin-edit-breaks PATCH:", err);
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
