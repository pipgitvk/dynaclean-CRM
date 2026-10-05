import { dateToYmdKey } from "@/lib/salaryPayDaysFromAttendance";

function parseLocalYmd(ymd) {
  const p = String(ymd || "").slice(0, 10).split("-");
  if (p.length < 3) return null;
  const yy = Number(p[0]);
  const mm = Number(p[1]);
  const dd = Number(p[2]);
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  const d = new Date(yy, mm - 1, dd);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Inclusive local calendar days from fromYmd through toYmd. */
export function eachDayInLeaveRange(fromYmd, toYmd) {
  const from = parseLocalYmd(fromYmd);
  const to = parseLocalYmd(toYmd);
  if (!from || !to || to < from) return [];
  const out = [];
  for (let d = new Date(from.getTime()); d <= to; d.setDate(d.getDate() + 1)) {
    out.push(new Date(d.getTime()));
  }
  return out;
}

/**
 * Build a Set of YYYY-MM-DD keys from holidays table rows (`holiday_date` field).
 */
export function holidayDateKeySet(holidays) {
  const set = new Set();
  for (const h of holidays || []) {
    const k = dateToYmdKey(h.holiday_date);
    if (k) set.add(k);
  }
  return set;
}

/**
 * Continuous leave: every calendar day in [from, to] counts toward leave balance,
 * including Saturday, Sunday, and company holidays in the span
 * (e.g. Sat + Sun + Mon = 3 days; leave + holiday + leave = 3 days).
 */
export function calculateContinuousLeaveDays(fromYmd, toYmd, holidays = []) {
  const holidayKeys = holidayDateKeySet(holidays);
  let sundays = 0;
  let holidaysInRange = 0;
  let weekdays = 0;

  for (const d of eachDayInLeaveRange(fromYmd, toYmd)) {
    const key = dateToYmdKey(d);
    const dow = d.getDay();
    const isSunday = dow === 0;
    const isHoliday = holidayKeys.has(key);

    if (isSunday) {
      sundays += 1;
    } else if (isHoliday) {
      holidaysInRange += 1;
    } else {
      weekdays += 1;
    }
  }

  const total = weekdays + sundays + holidaysInRange;

  return {
    totalDays: total,
    breakdown: { weekdays, sundays, holidays: holidaysInRange },
  };
}

export async function fetchCompanyHolidays(conn) {
  const [rows] = await conn.execute(
    `SELECT holiday_date, title FROM holidays ORDER BY holiday_date`
  );
  return rows || [];
}
