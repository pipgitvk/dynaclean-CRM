import dayjs from "dayjs";

/** Accrual start on/before this day → credit from 1st of same month; after → 1st of next month. */
export const PAID_LEAVE_ACCRUAL_CUTOFF_DAY = 15;

export function parseAccrualStartDate(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  const d = m ? dayjs(m[1], "YYYY-MM-DD") : dayjs(value);
  return d.isValid() ? d : null;
}

/**
 * First month when paid leave is credited (always on the 1st).
 * Start date day 1–15 → that month's 1st; day 16+ → next month's 1st.
 */
export function firstPaidLeaveCreditMonthStart(accrualStartDate) {
  const start = parseAccrualStartDate(accrualStartDate);
  if (!start) return null;
  if (start.date() <= PAID_LEAVE_ACCRUAL_CUTOFF_DAY) {
    return start.startOf("month");
  }
  return start.add(1, "month").startOf("month");
}

export function firstPaidLeaveCreditDateIso(accrualStartDate) {
  const m = firstPaidLeaveCreditMonthStart(accrualStartDate);
  return m ? m.format("YYYY-MM-DD") : null;
}

/** Each monthly credit posts on the 1st, from first credit month through asOf (inclusive). */
export function listPaidLeaveAccrualCreditDates(
  accrualStartDate,
  asOfDate = new Date(),
) {
  const first = firstPaidLeaveCreditMonthStart(accrualStartDate);
  if (!first) return [];
  const asOf = dayjs(asOfDate).startOf("month");
  if (first.isAfter(asOf)) return [];

  const dates = [];
  let cur = first;
  while (cur.isBefore(asOf) || cur.isSame(asOf, "month")) {
    dates.push(cur.format("YYYY-MM-DD"));
    cur = cur.add(1, "month");
  }
  return dates;
}

/**
 * Paid leave balance accrued so far (days), from monthly credits.
 * Sick/casual use full allowance — call only for paid leave.
 */
export function calculateAccruedPaidLeaveDays({
  joiningDate,
  accrualStartDate,
  maxAllowed,
  employmentStatus,
  asOfDate = new Date(),
}) {
  if (employmentStatus === "probation") return 0;
  const cap = Number(maxAllowed);
  if (!Number.isFinite(cap) || cap <= 0) return 0;

  const effective = accrualStartDate || joiningDate;
  if (!effective) return cap;

  const credits = listPaidLeaveAccrualCreditDates(effective, asOfDate).length;
  const monthly = cap / 12;
  const accrued = credits * monthly;
  return Math.min(cap, Math.round(accrued * 100) / 100);
}
