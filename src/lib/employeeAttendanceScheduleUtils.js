/** Client-safe helpers for employee_attendance_schedule (no DB imports). */

export function rowTimeToString(v) {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const s = v.trim();
    const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      return `${String(m[1]).padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}`;
    }
    return s.slice(0, 8);
  }
  if (v instanceof Date) {
    const h = v.getHours();
    const m = v.getMinutes();
    const sec = v.getSeconds();
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return String(v);
}

export const DEFAULT_EMPLOYEE_SCHEDULE = {
  checkin_time: "09:30:00",
  checkout_time: "18:30:00",
  break_morning: "11:15:00",
  break_lunch: "13:30:00",
  break_evening: "17:45:00",
  morning_duration_minutes: 15,
  lunch_duration_minutes: 30,
  evening_duration_minutes: 15,
  grace_period_minutes: 15,
  break_grace_period_minutes: 5,
};

export function normalizeEmployeeScheduleRow(row) {
  if (!row) {
    return { ...DEFAULT_EMPLOYEE_SCHEDULE, username: null };
  }

  return {
    username: row.username ?? null,
    checkin_time:
      rowTimeToString(row.checkin_time) ?? DEFAULT_EMPLOYEE_SCHEDULE.checkin_time,
    checkout_time:
      rowTimeToString(row.checkout_time) ?? DEFAULT_EMPLOYEE_SCHEDULE.checkout_time,
    break_morning:
      rowTimeToString(row.break_morning) ?? DEFAULT_EMPLOYEE_SCHEDULE.break_morning,
    break_lunch:
      rowTimeToString(row.break_lunch) ?? DEFAULT_EMPLOYEE_SCHEDULE.break_lunch,
    break_evening:
      rowTimeToString(row.break_evening) ?? DEFAULT_EMPLOYEE_SCHEDULE.break_evening,
    morning_duration_minutes:
      row.morning_duration_minutes ??
      DEFAULT_EMPLOYEE_SCHEDULE.morning_duration_minutes,
    lunch_duration_minutes:
      row.lunch_duration_minutes ??
      DEFAULT_EMPLOYEE_SCHEDULE.lunch_duration_minutes,
    evening_duration_minutes:
      row.evening_duration_minutes ??
      DEFAULT_EMPLOYEE_SCHEDULE.evening_duration_minutes,
    grace_period_minutes:
      row.grace_period_minutes ?? DEFAULT_EMPLOYEE_SCHEDULE.grace_period_minutes,
    break_grace_period_minutes:
      row.break_grace_period_minutes ??
      DEFAULT_EMPLOYEE_SCHEDULE.break_grace_period_minutes,
  };
}

export function formatScheduleTimeLabel(timeStr) {
  const normalized = rowTimeToString(timeStr);
  if (!normalized) return "--:--";
  const [h, m] = normalized.split(":");
  const hour = parseInt(h, 10);
  const min = m ?? "00";
  const h12 = hour % 12 || 12;
  const period = hour >= 12 ? "PM" : "AM";
  return `${h12}:${min} ${period}`;
}

/** Minutes from midnight for employee_attendance_schedule TIME values (IST wall clock). */
export function scheduleTimeToMinutes(timeStr) {
  const normalized = rowTimeToString(timeStr);
  if (!normalized) return null;
  const match = normalized.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}
