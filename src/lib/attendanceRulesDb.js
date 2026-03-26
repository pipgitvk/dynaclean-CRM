import { DEFAULT_ATTENDANCE_RULES } from "@/lib/attendanceRulesEngine";

const TABLE = "attendance_rules";

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

/** Map DB row → client rules shape */
export function rowToAttendanceRulesShape(row) {
  if (!row) return { ...DEFAULT_ATTENDANCE_RULES };
  return {
    checkin: rowTimeToString(row.checkin_time) || DEFAULT_ATTENDANCE_RULES.checkin,
    checkout: rowTimeToString(row.checkout_time) || DEFAULT_ATTENDANCE_RULES.checkout,
    gracePeriodMinutes:
      row.grace_period_minutes != null
        ? Number(row.grace_period_minutes)
        : DEFAULT_ATTENDANCE_RULES.gracePeriodMinutes,
    halfDayCheckin:
      rowTimeToString(row.half_day_checkin_time) || DEFAULT_ATTENDANCE_RULES.halfDayCheckin,
    halfDayCheckout:
      rowTimeToString(row.half_day_checkout_time) || DEFAULT_ATTENDANCE_RULES.halfDayCheckout,
    break_morning_start:
      rowTimeToString(row.break_morning_time) || DEFAULT_ATTENDANCE_RULES.break_morning_start,
    break_lunch_start:
      rowTimeToString(row.break_lunch_time) || DEFAULT_ATTENDANCE_RULES.break_lunch_start,
    break_evening_start:
      rowTimeToString(row.break_evening_time) || DEFAULT_ATTENDANCE_RULES.break_evening_start,
    breakDurations: {
      morning:
        row.morning_break_duration_min != null
          ? Number(row.morning_break_duration_min)
          : DEFAULT_ATTENDANCE_RULES.breakDurations.morning,
      lunch:
        row.lunch_break_duration_min != null
          ? Number(row.lunch_break_duration_min)
          : DEFAULT_ATTENDANCE_RULES.breakDurations.lunch,
      evening:
        row.evening_break_duration_min != null
          ? Number(row.evening_break_duration_min)
          : DEFAULT_ATTENDANCE_RULES.breakDurations.evening,
    },
    breakGracePeriodMinutes:
      row.break_grace_period_minutes != null
        ? Number(row.break_grace_period_minutes)
        : DEFAULT_ATTENDANCE_RULES.breakGracePeriodMinutes,
  };
}

/**
 * Merge global rules with one row from `employee_attendance_schedule`.
 * Any non-null column on the employee row overrides the company default.
 */
export function mergeGlobalRulesWithEmployeeSchedule(globalRules, emp) {
  if (!emp) return globalRules;
  const out = {
    ...globalRules,
    breakDurations: { ...globalRules.breakDurations },
  };
  if (emp.checkin_time != null) {
    out.checkin = rowTimeToString(emp.checkin_time) || out.checkin;
  }
  if (emp.checkout_time != null) {
    out.checkout = rowTimeToString(emp.checkout_time) || out.checkout;
  }
  if (emp.grace_period_minutes != null) {
    out.gracePeriodMinutes = Number(emp.grace_period_minutes);
  }
  if (emp.half_day_checkin_time != null) {
    out.halfDayCheckin = rowTimeToString(emp.half_day_checkin_time) || out.halfDayCheckin;
  }
  if (emp.half_day_checkout_time != null) {
    out.halfDayCheckout = rowTimeToString(emp.half_day_checkout_time) || out.halfDayCheckout;
  }
  if (emp.break_morning != null) {
    out.break_morning_start = rowTimeToString(emp.break_morning) || out.break_morning_start;
  }
  if (emp.break_lunch != null) {
    out.break_lunch_start = rowTimeToString(emp.break_lunch) || out.break_lunch_start;
  }
  if (emp.break_evening != null) {
    out.break_evening_start = rowTimeToString(emp.break_evening) || out.break_evening_start;
  }
  if (emp.morning_duration_minutes != null) {
    out.breakDurations.morning = Number(emp.morning_duration_minutes);
  }
  if (emp.lunch_duration_minutes != null) {
    out.breakDurations.lunch = Number(emp.lunch_duration_minutes);
  }
  if (emp.evening_duration_minutes != null) {
    out.breakDurations.evening = Number(emp.evening_duration_minutes);
  }
  if (emp.break_grace_period_minutes != null) {
    out.breakGracePeriodMinutes = Number(emp.break_grace_period_minutes);
  }
  return out;
}

