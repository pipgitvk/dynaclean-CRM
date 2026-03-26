import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getMainSessionPayload } from "@/lib/auth";
import {
  ensureAttendanceRulesTable,
  loadGlobalAttendanceRulesRow,
} from "@/lib/ensureAttendanceRulesTable";
import { rowToAttendanceRulesShape } from "@/lib/attendanceRulesDb";
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

export async function GET() {
  try {
    const payload = await getMainSessionPayload();
    if (!payload?.username) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const role = await resolveRoleForAttendanceAdmin(payload);
    if (!canManageAttendanceRules(role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const conn = await getDbConnection();
    const row = await loadGlobalAttendanceRulesRow(conn);
    const rules = rowToAttendanceRulesShape(row);
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("admin attendance-rules GET:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const payload = await getMainSessionPayload();
    if (!payload?.username) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const role = await resolveRoleForAttendanceAdmin(payload);
    if (!canManageAttendanceRules(role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await req.json();

    await ensureAttendanceRulesTable();
    const conn = await getDbConnection();

    const checkin_time = normalizeTimeToHHMMSS(body.checkin) ?? "09:30:00";
    const checkout_time = normalizeTimeToHHMMSS(body.checkout) ?? "18:30:00";
    const half_day_checkin_time = normalizeTimeToHHMMSS(body.halfDayCheckin) ?? "10:00:00";
    const half_day_checkout_time = normalizeTimeToHHMMSS(body.halfDayCheckout) ?? "18:14:00";
    const break_morning_time = normalizeTimeToHHMMSS(body.break_morning_start) ?? "11:15:00";
    const break_lunch_time = normalizeTimeToHHMMSS(body.break_lunch_start) ?? "13:30:00";
    const break_evening_time = normalizeTimeToHHMMSS(body.break_evening_start) ?? "17:45:00";

    const grace_period_minutes = num(body.gracePeriodMinutes, 15);
    const morning_break_duration_min = num(body.breakDurations?.morning, 15);
    const lunch_break_duration_min = num(body.breakDurations?.lunch, 30);
    const evening_break_duration_min = num(body.breakDurations?.evening, 15);
    const break_grace_period_minutes = num(body.breakGracePeriodMinutes, 5);

    await conn.query(
      `UPDATE attendance_rules SET
        checkin_time = ?,
        checkout_time = ?,
        grace_period_minutes = ?,
        half_day_checkin_time = ?,
        half_day_checkout_time = ?,
        break_morning_time = ?,
        break_lunch_time = ?,
        break_evening_time = ?,
        morning_break_duration_min = ?,
        lunch_break_duration_min = ?,
        evening_break_duration_min = ?,
        break_grace_period_minutes = ?
      WHERE id = 1`,
      [
        checkin_time,
        checkout_time,
        grace_period_minutes,
        half_day_checkin_time,
        half_day_checkout_time,
        break_morning_time,
        break_lunch_time,
        break_evening_time,
        morning_break_duration_min,
        lunch_break_duration_min,
        evening_break_duration_min,
        break_grace_period_minutes,
      ]
    );

    const row = await loadGlobalAttendanceRulesRow(conn);
    return NextResponse.json({ success: true, rules: rowToAttendanceRulesShape(row) });
  } catch (error) {
    console.error("admin attendance-rules PUT:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
