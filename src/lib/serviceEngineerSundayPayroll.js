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

function normalizeLocationText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Delhi/NCR cues in a free-text location (profile or GPS address). */
function isDelhiNcrRegionText(text) {
  const s = normalizeLocationText(text);
  if (!s) return false;
  return (
    /\bdelhi\b/.test(s) ||
    s.includes("new delhi") ||
    /\bncr\b/.test(s) ||
    s.includes("nct of delhi") ||
    s.includes("national capital territory") ||
    s.includes("noida") ||
    s.includes("gurgaon") ||
    s.includes("gurugram") ||
    s.includes("faridabad") ||
    s.includes("ghaziabad")
  );
}

function workLocationParts(workLocation) {
  const n = normalizeLocationText(workLocation);
  if (!n) return [];
  return n
    .split(/[,/|;]+|\s+-\s+|\band\b/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
}

/**
 * True when attendance_logs check-in (or checkout) address aligns with profile work_location.
 * Uses substring / part tokens; Delhi/NCR labels match any Delhi/NCR attendance address.
 */
export function attendanceLocationMatchesWorkLocation(checkinAddress, workLocation) {
  const addr = normalizeLocationText(checkinAddress);
  const work = normalizeLocationText(workLocation);
  if (!addr || !work) return false;

  if (addr.includes(work) || work.includes(addr)) return true;

  const parts = workLocationParts(workLocation).filter((p) => p.length >= 3);
  if (parts.some((p) => addr.includes(p))) return true;

  if (isDelhiNcrRegionText(workLocation) && isDelhiNcrRegionText(checkinAddress)) {
    return true;
  }

  return false;
}

function attendanceLocationFromLog(log) {
  const checkin = String(log?.checkin_address ?? "").trim();
  if (checkin) return checkin;
  return String(log?.checkout_address ?? "").trim();
}

/**
 * +1 pay day on Sunday / company holiday only when check-in exists and
 * attendance location matches profile work_location.
 */
export function qualifiesOffDayExtraPayCredit(log, workLocation) {
  if (!log) return false;
  if (!rowHasMeaningfulCheckinOrCheckout(log)) return false;
  if (!isMeaningfulAttendancePunch(log.checkin_time)) return false;
  return attendanceLocationMatchesWorkLocation(
    attendanceLocationFromLog(log),
    workLocation
  );
}

/** @deprecated Use qualifiesOffDayExtraPayCredit — same rule for all roles. */
export function shouldCountSundayWorkForSalary({ userRole, log, workLocation = null }) {
  return qualifiesOffDayExtraPayCredit(log, workLocation);
}
