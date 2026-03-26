import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getMainSessionPayload } from "@/lib/auth";
import { ensureEmployeeAttendanceScheduleTable } from "@/lib/ensureEmployeeAttendanceScheduleTable";
import {
  canManageAttendanceRules,
  resolveRoleForAttendanceAdmin,
} from "@/lib/adminAttendanceRulesAuth";

/** Normalize to HH:mm:ss for MySQL TIME */
function normalizeTimeToHHMMSS(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  const sec = m[3] != null ? Math.min(59, Math.max(0, parseInt(m[3], 10))) : 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function rowTimeToString(v) {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const s = v.slice(0, 8);
    return s.length === 8 ? s : `${s}:00`.slice(0, 8);
  }
  if (v instanceof Date) {
    const h = v.getHours();
    const m = v.getMinutes();
    const sec = v.getSeconds();
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return String(v);
}

/** GET — list active employees with optional schedule.
 *  Query: ?onlyWithSchedule=1 — only employees who have a row in employee_attendance_schedule (custom rules added).
 */
export async function GET(req) {
  try {
    const payload = await getMainSessionPayload();
    if (!payload) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!canManageAttendanceRules(payload.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const onlyWithSchedule =
      typeof req?.url === "string" &&
      new URL(req.url).searchParams.get("onlyWithSchedule") === "1";

    await ensureEmployeeAttendanceScheduleTable();
    const db = await getDbConnection();
    const joinSql = onlyWithSchedule
      ? `FROM rep_list e
       INNER JOIN employee_attendance_schedule s ON s.username = e.username
       WHERE e.status = 1`
      : `FROM rep_list e
       LEFT JOIN employee_attendance_schedule s ON s.username = e.username
       WHERE e.status = 1`;

    const [rows] = await db.query(
      `SELECT
         e.username,
         e.email,
         e.userRole,
         e.empId,
         s.checkin_time,
         s.break_morning,
         s.break_lunch,
         s.break_evening,
         s.checkout_time,
         s.morning_duration_minutes,
         s.lunch_duration_minutes,
         s.evening_duration_minutes,
         s.grace_period_minutes,
         s.half_day_checkin_time,
         s.half_day_checkout_time,
         s.break_grace_period_minutes
       ${joinSql}
       ORDER BY e.username ASC`
    );

    const employees = rows.map((r) => ({
      username: r.username,
      email: r.email,
      userRole: r.userRole,
      empId: r.empId,
      checkin_time: rowTimeToString(r.checkin_time),
      break_morning: rowTimeToString(r.break_morning),
      break_lunch: rowTimeToString(r.break_lunch),
      break_evening: rowTimeToString(r.break_evening),
      checkout_time: rowTimeToString(r.checkout_time),
      morning_duration_minutes: r.morning_duration_minutes,
      lunch_duration_minutes: r.lunch_duration_minutes,
      evening_duration_minutes: r.evening_duration_minutes,
      grace_period_minutes: r.grace_period_minutes,
      half_day_checkin_time: rowTimeToString(r.half_day_checkin_time),
      half_day_checkout_time: rowTimeToString(r.half_day_checkout_time),
      break_grace_period_minutes: r.break_grace_period_minutes,
    }));

    return NextResponse.json({ employees });
  } catch (error) {
    console.error("admin employee-attendance-schedule GET:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

/** PUT — upsert schedule for one employee */
export async function PUT(req) {
  try {
    const payload = await getMainSessionPayload();
    if (!payload?.username) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const role = await resolveRoleForAttendanceAdmin(payload);
    if (!canManageAttendanceRules(role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const username = body?.username != null ? String(body.username).trim() : "";
    if (!username) {
      return NextResponse.json({ message: "username is required" }, { status: 400 });
    }

    const checkin_time = normalizeTimeToHHMMSS(body.checkin_time);
    const break_morning = normalizeTimeToHHMMSS(body.break_morning);
    const break_lunch = normalizeTimeToHHMMSS(body.break_lunch);
    const break_evening = normalizeTimeToHHMMSS(body.break_evening);
    const checkout_time = normalizeTimeToHHMMSS(body.checkout_time);

    await ensureEmployeeAttendanceScheduleTable();
    const db = await getDbConnection();
    const [empCheck] = await db.query(
      "SELECT username FROM rep_list WHERE username = ? AND status = 1 LIMIT 1",
      [username]
    );
    if (!empCheck.length) {
      return NextResponse.json({ message: "Active employee not found" }, { status: 404 });
    }

    await db.query(
      `INSERT INTO employee_attendance_schedule
        (username, checkin_time, break_morning, break_lunch, break_evening, checkout_time)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        checkin_time = VALUES(checkin_time),
        break_morning = VALUES(break_morning),
        break_lunch = VALUES(break_lunch),
        break_evening = VALUES(break_evening),
        checkout_time = VALUES(checkout_time)`,
      [username, checkin_time, break_morning, break_lunch, break_evening, checkout_time]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("admin employee-attendance-schedule PUT:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
