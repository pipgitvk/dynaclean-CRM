import { isAutomaticCheckoutAddress } from "@/lib/attendanceAutoCheckoutConstants";

/**
 * System auto check-out (9 PM) counts for payroll only after HR approval.
 * Unapproved rows keep checkout_address = "Automatic"; approved rows use Admin (or manual GPS).
 */
export function isUnapprovedAutomaticCheckoutLog(log) {
  return isAutomaticCheckoutAddress(log?.checkout_address);
}

/**
 * Unapproved auto check-out → half-day for salary / sheet (not full present).
 * Approved rows (checkout_address ≠ Automatic) use normal rules with check-out time.
 */
export function isPayrollHalfDayFromUnapprovedAutoCheckout(log) {
  return isUnapprovedAutomaticCheckoutLog(log);
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
