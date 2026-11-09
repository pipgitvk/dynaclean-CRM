import { normalizeUserKey } from "@/lib/employeeProfileLookup";
import { dateToYmdKey } from "@/lib/salaryPayDaysFromAttendance";
import {
  loadMachineCodeMaps,
  loadMachineDailyByUsername,
  mergeAttendanceListWithMachine,
  mergeCrmAndMachineDay,
} from "@/lib/attendanceMachineMerge";

/** Log columns needed for salary / attendance cards (incl. auto check-out approval). */
export const PAYROLL_ATTENDANCE_LOG_SELECT = `
      a.username, a.date, a.checkin_time, a.checkout_time,
      a.checkin_latitude, a.checkin_longitude, a.checkin_address,
      a.checkout_latitude, a.checkout_longitude, a.checkout_address,
      a.break_morning_start, a.break_morning_end,
      a.break_lunch_start, a.break_lunch_end,
      a.break_evening_start, a.break_evening_end,
      ap.status AS auto_checkout_approval_status
`;

export const PAYROLL_ATTENDANCE_LOG_FROM = `
      FROM attendance_logs a
      LEFT JOIN attendance_auto_checkout_approvals ap
        ON ap.username = a.username AND ap.log_date = DATE(a.date)
`;

export function machineMapForUsersAndMonth(
  machineByUserDate,
  relatedUsernames,
  from,
  to,
) {
  const users = new Set(relatedUsernames.map((u) => normalizeUserKey(u)));
  const filtered = new Map();
  for (const [key, val] of machineByUserDate.entries()) {
    const pipe = key.indexOf("|");
    if (pipe < 0) continue;
    const u = key.slice(0, pipe);
    const dateYmd = key.slice(pipe + 1);
    if (!users.has(normalizeUserKey(u))) continue;
    if (dateYmd < from || dateYmd > to) continue;
    filtered.set(key, val);
  }
  return filtered;
}

/** One log per calendar day when multiple related usernames / merged rows exist. */
export function collapseMergedAttendanceByDate(mergedList) {
  const byDate = new Map();
  for (const row of mergedList) {
    const dk = dateToYmdKey(row.date);
    if (!dk) continue;
    const prev = byDate.get(dk);
    if (!prev) {
      byDate.set(dk, { ...row, date: dk });
      continue;
    }
    byDate.set(
      dk,
      mergeCrmAndMachineDay(
        {
          ...prev,
          checkin_time: prev.checkin_time,
          checkout_time: prev.checkout_time,
        },
        {
          machine_checkin: row.checkin_time,
          machine_checkout: row.checkout_time,
          emp_code: row.machine_day?.emp_code ?? prev.machine_day?.emp_code,
        },
      ),
    );
  }
  return Array.from(byDate.values());
}

export async function loadPayrollMachineByUserDate(db, fromYmd, toYmd) {
  const { machineCodeToUsername } = await loadMachineCodeMaps(db);
  return loadMachineDailyByUsername(db, machineCodeToUsername, {
    fromDate: fromYmd,
    toDate: toYmd,
  });
}

/**
 * CRM + machine punches for payroll (same merge as attendance sheet / fetch-all).
 */
export function buildMergedPayrollLogsForEmployee({
  logsByUser,
  machineByUserDate,
  relatedUsernames,
  from,
  to,
}) {
  const crmLogs = [];
  const logDates = new Set();
  for (const uname of relatedUsernames || []) {
    for (const log of logsByUser[normalizeUserKey(uname)] || []) {
      const dk = dateToYmdKey(log.date);
      if (dk && logDates.has(dk)) continue;
      if (dk) logDates.add(dk);
      crmLogs.push(log);
    }
  }
  const machineSlice = machineMapForUsersAndMonth(
    machineByUserDate,
    relatedUsernames || [],
    from,
    to,
  );
  return collapseMergedAttendanceByDate(
    mergeAttendanceListWithMachine(crmLogs, machineSlice),
  );
}
