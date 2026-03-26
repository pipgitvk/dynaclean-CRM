import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getMainSessionPayload } from "@/lib/auth";
import { ensureEmployeeAttendanceScheduleTable } from "@/lib/ensureEmployeeAttendanceScheduleTable";
import {
  canManageAttendanceRules,
  resolveRoleForAttendanceAdmin,
} from "@/lib/adminAttendanceRulesAuth";

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

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Map company-rules form body → employee_attendance_schedule columns */
function bodyToScheduleValues(body) {
  return {
    checkin_time: normalizeTimeToHHMMSS(body.checkin),
    checkout_time: normalizeTimeToHHMMSS(body.checkout),
    grace_period_minutes: num(body.gracePeriodMinutes, 15),
    half_day_checkin_time: normalizeTimeToHHMMSS(body.halfDayCheckin),
    half_day_checkout_time: normalizeTimeToHHMMSS(body.halfDayCheckout),
    break_morning: normalizeTimeToHHMMSS(body.break_morning_start),
    break_lunch: normalizeTimeToHHMMSS(body.break_lunch_start),
    break_evening: normalizeTimeToHHMMSS(body.break_evening_start),
    morning_duration_minutes: num(body.breakDurations?.morning, 15),
    lunch_duration_minutes: num(body.breakDurations?.lunch, 30),
    evening_duration_minutes: num(body.breakDurations?.evening, 15),
    break_grace_period_minutes: num(body.breakGracePeriodMinutes, 5),
  };
}

/**
 * POST — apply the same timings (as in company rules form) to many employees at once.
 * Body: { usernames: string[], ...checkin, checkout, gracePeriodMinutes, ... }
 */
export async function POST(req) {
  try {
    const payload = await getMainSessionPayload();
    if (!payload?.username) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const role = await resolveRoleForAttendanceAdmin(payload);
    if (!canManageAttendanceRules(role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const rawList = body?.usernames;
    const usernames = Array.isArray(rawList)
      ? rawList.map((u) => String(u ?? "").trim()).filter(Boolean)
      : [];
    if (usernames.length === 0) {
      return NextResponse.json({ message: "Select at least one employee" }, { status: 400 });
    }

    const v = bodyToScheduleValues(body);

    await ensureEmployeeAttendanceScheduleTable();
    const db = await getDbConnection();

    const sql = `INSERT INTO employee_attendance_schedule (
      username,
      checkin_time, checkout_time,
      grace_period_minutes, half_day_checkin_time, half_day_checkout_time,
      break_morning, break_lunch, break_evening,
      morning_duration_minutes, lunch_duration_minutes, evening_duration_minutes,
      break_grace_period_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      checkin_time = VALUES(checkin_time),
      checkout_time = VALUES(checkout_time),
      grace_period_minutes = VALUES(grace_period_minutes),
      half_day_checkin_time = VALUES(half_day_checkin_time),
      half_day_checkout_time = VALUES(half_day_checkout_time),
      break_morning = VALUES(break_morning),
      break_lunch = VALUES(break_lunch),
      break_evening = VALUES(break_evening),
      morning_duration_minutes = VALUES(morning_duration_minutes),
      lunch_duration_minutes = VALUES(lunch_duration_minutes),
      evening_duration_minutes = VALUES(evening_duration_minutes),
      break_grace_period_minutes = VALUES(break_grace_period_minutes)`;

    let applied = 0;
    const skipped = [];

    for (const username of usernames) {
      const [empCheck] = await db.query(
        "SELECT username FROM rep_list WHERE username = ? AND status = 1 LIMIT 1",
        [username]
      );
      if (!empCheck.length) {
        skipped.push(username);
        continue;
      }
      await db.query(sql, [
        username,
        v.checkin_time,
        v.checkout_time,
        v.grace_period_minutes,
        v.half_day_checkin_time,
        v.half_day_checkout_time,
        v.break_morning,
        v.break_lunch,
        v.break_evening,
        v.morning_duration_minutes,
        v.lunch_duration_minutes,
        v.evening_duration_minutes,
        v.break_grace_period_minutes,
      ]);
      applied++;
    }

    return NextResponse.json({ success: true, applied, skipped });
  } catch (error) {
    console.error("employee-attendance-schedule batch POST:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
