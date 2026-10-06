import {
  isMeaningfulAttendancePunch,
  rowHasMeaningfulCheckinOrCheckout,
} from "@/lib/attendanceMeaningfulPunch";

export function normalizePayrollRole(role) {
  return String(role ?? "").trim().toUpperCase();
}

export function isServiceEngineerRole(role) {
  return normalizePayrollRole(role) === "SERVICE ENGINEER";
}

/** Delhi/NCR from attendance_logs.checkin_address (not profile work location). */
export function isDelhiFromCheckInAddress(checkinAddress) {
  const s = String(checkinAddress ?? "").trim().toLowerCase();
  if (!s) return false;
  return (
    /\bdelhi\b/.test(s) ||
    s.includes("new delhi") ||
    /\bncr\b/.test(s) ||
    s.includes("nct of delhi") ||
    s.includes("national capital territory")
  );
}

export function isDelhiFromAttendanceLog(log) {
  if (!log) return false;
  return isDelhiFromCheckInAddress(log.checkin_address);
}

/**
 * Sunday punch counts toward salary "Sunday work" bonus only when:
 * - Non–service-engineer: any meaningful check-in or checkout (unchanged).
 * - Service engineer: meaningful check-in AND check-in address in Delhi/NCR (attendance log).
 * - Service engineer outside Delhi (e.g. Gujarat): never.
 */
export function shouldCountSundayWorkForSalary({ userRole, log }) {
  if (!rowHasMeaningfulCheckinOrCheckout(log)) return false;
  if (!isServiceEngineerRole(userRole)) return true;
  if (!isMeaningfulAttendancePunch(log.checkin_time)) return false;
  return isDelhiFromAttendanceLog(log);
}
