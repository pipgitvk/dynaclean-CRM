import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

const HR_ATTENDANCE_ROLES = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"];

const BREAK_COLUMNS = [
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
 * PATCH — admin edits break start/end times for one attendance row.
 * Body: { username, date: "YYYY-MM-DD", ...break columns as string or null }
 */
export async function PATCH(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }
    if (!isHrRole(payload.role)) {
      return NextResponse.json(
        { message: "Only HR / SUPERADMIN can edit attendance breaks." },
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

    const assignments = [];
    const params = [];
    for (const col of BREAK_COLUMNS) {
      if (!Object.prototype.hasOwnProperty.call(body, col)) {
        return NextResponse.json(
          { message: `Missing field: ${col}` },
          { status: 400 }
        );
      }
      const raw = body[col];
      if (raw === null || raw === "") {
        assignments.push(`${col} = NULL`);
      } else {
        const normalized = normalizeMysqlDatetime(raw);
        if (!normalized) {
          return NextResponse.json(
            { message: `Invalid datetime for ${col}` },
            { status: 400 }
          );
        }
        assignments.push(`${col} = ?`);
        params.push(normalized);
      }
    }

    const conn = await getDbConnection();
    const [exists] = await conn.execute(
      "SELECT 1 FROM attendance_logs WHERE username = ? AND date = ? LIMIT 1",
      [username, dateStr]
    );
    if (!exists.length) {
      return NextResponse.json(
        { message: "No attendance record for that user and date." },
        { status: 404 }
      );
    }

    const sql = `UPDATE attendance_logs SET ${assignments.join(", ")} WHERE username = ? AND date = ?`;
    await conn.execute(sql, [...params, username, dateStr]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("admin-edit-breaks PATCH:", err);
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
