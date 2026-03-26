import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureEmployeeAttendanceScheduleTable } from "@/lib/ensureEmployeeAttendanceScheduleTable";
import { loadGlobalAttendanceRulesRow } from "@/lib/ensureAttendanceRulesTable";
import { rowToAttendanceRulesShape } from "@/lib/attendanceRulesDb";

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

/** GET — merged global `attendance_rules` + optional per-employee overrides (tracker UI) */
export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const username = payload.username;

    const db = await getDbConnection();
    const globalRow = await loadGlobalAttendanceRulesRow(db);
    const global = rowToAttendanceRulesShape(globalRow);

    await ensureEmployeeAttendanceScheduleTable();
    const [rows] = await db.query(
      `SELECT
         checkin_time,
         break_morning,
         break_lunch,
         break_evening,
         checkout_time,
         morning_duration_minutes,
         lunch_duration_minutes,
         evening_duration_minutes
       FROM employee_attendance_schedule
       WHERE username = ?
       LIMIT 1`,
      [username]
    );

    const r = rows[0];
    return NextResponse.json({
      checkin_time: r?.checkin_time != null ? rowTimeToString(r.checkin_time) : global.checkin,
      break_morning: r?.break_morning != null ? rowTimeToString(r.break_morning) : global.break_morning_start,
      break_lunch: r?.break_lunch != null ? rowTimeToString(r.break_lunch) : global.break_lunch_start,
      break_evening: r?.break_evening != null ? rowTimeToString(r.break_evening) : global.break_evening_start,
      checkout_time: r?.checkout_time != null ? rowTimeToString(r.checkout_time) : global.checkout,
      morning_duration_minutes:
        r?.morning_duration_minutes != null
          ? r.morning_duration_minutes
          : global.breakDurations.morning,
      lunch_duration_minutes:
        r?.lunch_duration_minutes != null
          ? r.lunch_duration_minutes
          : global.breakDurations.lunch,
      evening_duration_minutes:
        r?.evening_duration_minutes != null
          ? r.evening_duration_minutes
          : global.breakDurations.evening,
    });
  } catch (error) {
    console.error("empcrm attendance-schedule GET:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
