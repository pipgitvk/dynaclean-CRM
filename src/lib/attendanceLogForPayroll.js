import { isAutomaticCheckoutAddress } from "@/lib/attendanceAutoCheckoutConstants";

/**
 * System auto check-out counts as full present only after admin approval
 * (checkout_address → Admin, or attendance_auto_checkout_approvals.status = approved).
 * Until then: half-day in summary cards.
 */
export function isUnapprovedAutomaticCheckoutLog(log) {
  if (!log) return false;
  const approval = String(log.auto_checkout_approval_status ?? "")
    .trim()
    .toLowerCase();
  if (approval === "approved") return false;
  return isAutomaticCheckoutAddress(log?.checkout_address);
}

/** Automatic check-out still waiting for admin approval (counts as half-day). */
export function isPendingAutomaticCheckoutForSummary(log) {
  return isUnapprovedAutomaticCheckoutLog(log);
}

/**
 * Unapproved auto check-out → half-day for salary / sheet (not full present).
 * Approved rows (checkout_address ≠ Automatic) use normal rules with check-out time.
 */
export function isPayrollHalfDayFromUnapprovedAutoCheckout(log) {
  return isUnapprovedAutomaticCheckoutLog(log);
}

/**
 * Present card: only unapproved auto check-out reduces to 0.5; all other present rows = 1.
 */
export function presentCreditForPresentRow(log) {
  if (isUnapprovedAutomaticCheckoutLog(log)) return 0.5;
  return 1;
}

/** @deprecated use presentCreditForPresentRow */
export function presentDayCreditForSummary(log) {
  return presentCreditForPresentRow(log);
}

/** Half-Days card +1 on present row: auto check-out, or attendance-rules half-day (not leave half-day on present). */
export function countsHalfDayInSummaryForPresent(log, classifyKind) {
  if (isUnapprovedAutomaticCheckoutLog(log)) return true;
  return classifyKind === "halfDay";
}

export function formatPresentSummaryCount(present) {
  const v = Number(present) || 0;
  if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
  return v.toFixed(1);
}

/** Strip 9 PM check-out from pay math until HR approves; half-day is applied explicitly in payroll libs. */
export function sanitizeAttendanceLogForPayroll(log) {
  if (!log || !isUnapprovedAutomaticCheckoutLog(log)) return log;
  return {
    ...log,
    checkout_time: null,
    checkout_latitude: null,
    checkout_longitude: null,
  };
}

export function mapAttendanceLogsForPayroll(logs) {
  if (!Array.isArray(logs)) return [];
  return logs.map(sanitizeAttendanceLogForPayroll);
}
