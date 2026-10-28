import { isMeaningfulAttendancePunch } from "@/lib/attendanceMeaningfulPunch";
import { parseAttendanceDateTime } from "@/lib/istDateTime";
import { attendanceDateKey } from "@/lib/leaveDateRange";
import { ensureRepListMachineCodeColumn } from "@/lib/ensureRepListMachineCode";
import { ensureMachineAttendancePunchesTable } from "@/lib/ensureMachineAttendancePunchesTable";
import {
  AUTO_CHECKOUT_WALL_TIME,
  isAutomaticCheckoutAddress,
} from "@/lib/attendanceAutoCheckoutConstants";
export const MACHINE_ATTENDANCE_ADDRESS = "Machine";

/** Raw check-in/out stored on attendance_logs (not merged display times). */
export function extractCrmPunchesFromAttendanceLogRow(crmRow) {
  if (!crmRow || crmRow._syntheticMachineOnly) {
    return { checkin: null, checkout: null };
  }
  const checkin = crmRow.checkin_time ?? null;
  const checkout = crmRow.checkout_time ?? null;
  return {
    checkin: isMeaningfulAttendancePunch(checkin) ? checkin : null,
    checkout: isMeaningfulAttendancePunch(checkout) ? checkout : null,
  };
}

/** CRM app check-in missing, but biometric/machine recorded check-in. */
export function isMachineOnlyCheckinAttendanceDay(crmRow, machineDay) {
  const { checkin: crmIn } = extractCrmPunchesFromAttendanceLogRow(crmRow);
  const macIn = machineDay?.machine_checkin ?? null;
  return (
    !isMeaningfulAttendancePunch(crmIn) &&
    isMeaningfulAttendancePunch(macIn)
  );
}

/** Machine recorded check-out strictly before 9:00 PM IST on that date. */
export function machineCheckoutIsBeforeNinePm(
  machineCheckout,
  dateYmd,
  wallTime = AUTO_CHECKOUT_WALL_TIME,
) {
  if (!dateYmd || !isMeaningfulAttendancePunch(machineCheckout)) return false;
  const t = String(wallTime || AUTO_CHECKOUT_WALL_TIME).trim();
  const normalized = t.length === 5 ? `${t}:00` : t;
  const cutoff = parseAttendanceDateTime(`${dateYmd} ${normalized}`);
  const mac = parseAttendanceDateTime(machineCheckout);
  if (!cutoff || !mac) return false;
  return mac.getTime() < cutoff.getTime();
}

export function getAttendanceSourcesDetailFromLog(log) {
  if (!log) return null;

  const crm = {
    checkin: isMeaningfulAttendancePunch(log.crm_checkin_time)
      ? log.crm_checkin_time
      : null,
    checkout: isMeaningfulAttendancePunch(log.crm_checkout_time)
      ? log.crm_checkout_time
      : null,
  };

  const md = log.machine_day;
  const machine = {
    checkin: isMeaningfulAttendancePunch(md?.machine_checkin)
      ? md.machine_checkin
      : null,
    checkout: isMeaningfulAttendancePunch(md?.machine_checkout)
      ? md.machine_checkout
      : null,
  };

  const embedded = log.attendance_sources_detail;
  if (!crm.checkin && isMeaningfulAttendancePunch(embedded?.crm?.checkin)) {
    crm.checkin = embedded.crm.checkin;
  }
  if (!crm.checkout && isMeaningfulAttendancePunch(embedded?.crm?.checkout)) {
    crm.checkout = embedded.crm.checkout;
  }
  if (!machine.checkin && isMeaningfulAttendancePunch(embedded?.machine?.checkin)) {
    machine.checkin = embedded.machine.checkin;
  }
  if (!machine.checkout && isMeaningfulAttendancePunch(embedded?.machine?.checkout)) {
    machine.checkout = embedded.machine.checkout;
  }

  const sources = log.merge_sources;
  if (
    !crm.checkin &&
    sources?.checkin === "crm" &&
    isMeaningfulAttendancePunch(log.checkin_time)
  ) {
    crm.checkin = log.checkin_time;
  }
  if (
    !crm.checkout &&
    sources?.checkout === "crm" &&
    isMeaningfulAttendancePunch(log.checkout_time)
  ) {
    crm.checkout = log.checkout_time;
  }
  if (
    !machine.checkin &&
    sources?.checkin === "machine" &&
    isMeaningfulAttendancePunch(log.checkin_time)
  ) {
    machine.checkin = log.checkin_time;
  }
  if (
    !machine.checkout &&
    sources?.checkout === "machine" &&
    isMeaningfulAttendancePunch(log.checkout_time)
  ) {
    machine.checkout = log.checkout_time;
  }

  const hasAny =
    isMeaningfulAttendancePunch(crm.checkin) ||
    isMeaningfulAttendancePunch(crm.checkout) ||
    isMeaningfulAttendancePunch(machine.checkin) ||
    isMeaningfulAttendancePunch(machine.checkout);
  return hasAny ? { crm, machine } : null;
}

function compareInstants(a, b) {
  const da = parseAttendanceDateTime(a);
  const db = parseAttendanceDateTime(b);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da.getTime() - db.getTime();
}

function pickEarlierCheckin(crmVal, machineVal) {
  const hasCrm = isMeaningfulAttendancePunch(crmVal);
  const hasMac = isMeaningfulAttendancePunch(machineVal);
  if (hasCrm && hasMac) {
    if (compareInstants(crmVal, machineVal) <= 0) {
      return { value: crmVal, source: "crm" };
    }
    return { value: machineVal, source: "machine" };
  }
  if (hasCrm) return { value: crmVal, source: "crm" };
  if (hasMac) return { value: machineVal, source: "machine" };
  return { value: null, source: null };
}

function pickLaterCheckout(crmVal, machineVal) {
  const hasCrm = isMeaningfulAttendancePunch(crmVal);
  const hasMac = isMeaningfulAttendancePunch(machineVal);
  if (hasCrm && hasMac) {
    if (compareInstants(crmVal, machineVal) >= 0) {
      return { value: crmVal, source: "crm" };
    }
    return { value: machineVal, source: "machine" };
  }
  if (hasCrm) return { value: crmVal, source: "crm" };
  if (hasMac) return { value: machineVal, source: "machine" };
  return { value: null, source: null };
}

/** Any real checkout on CRM or machine (including Automatic on CRM). */
export function mergedHasCheckout(crmCheckout, machineCheckout) {
  if (isMeaningfulAttendancePunch(crmCheckout)) return true;
  if (isMeaningfulAttendancePunch(machineCheckout)) return true;
  return false;
}

export function mergeCrmAndMachineDay(crmRow, machineDay) {
  const { checkin: crmIn, checkout: crmOut } =
    extractCrmPunchesFromAttendanceLogRow(crmRow);
  const macIn = machineDay?.machine_checkin ?? null;
  const macOut = machineDay?.machine_checkout ?? null;

  const machineOnlyCheckin = isMachineOnlyCheckinAttendanceDay(crmRow, machineDay);
  const dateYmdForRow = attendanceDateKey(crmRow?.date) || machineDay?.punch_date || "";
  let crmOutForMerge = crmOut;
  if (
    isAutomaticCheckoutAddress(crmRow?.checkout_address) &&
    (machineOnlyCheckin ||
      machineCheckoutIsBeforeNinePm(macOut, dateYmdForRow))
  ) {
    crmOutForMerge = null;
  }

  const checkinPick = pickEarlierCheckin(crmIn, macIn);
  const checkoutPick = pickLaterCheckout(crmOutForMerge, macOut);

  const merged = {
    ...(crmRow || {}),
    crm_checkin_time: isMeaningfulAttendancePunch(crmIn) ? crmIn : null,
    crm_checkout_time: isMeaningfulAttendancePunch(crmOut) ? crmOut : null,
    checkin_time: checkinPick.value,
    checkout_time: checkoutPick.value,
    merge_sources: {
      checkin: checkinPick.source,
      checkout: checkoutPick.source,
    },
    attendance_sources_detail: {
      crm: {
        checkin: isMeaningfulAttendancePunch(crmIn) ? crmIn : null,
        checkout: isMeaningfulAttendancePunch(crmOut) ? crmOut : null,
      },
      machine: {
        checkin: isMeaningfulAttendancePunch(macIn) ? macIn : null,
        checkout: isMeaningfulAttendancePunch(macOut) ? macOut : null,
      },
    },
    machine_day: machineDay
      ? {
          emp_code: machineDay.emp_code,
          machine_checkin: machineDay.machine_checkin,
          machine_checkout: machineDay.machine_checkout,
        }
      : null,
  };

  if (checkoutPick.source === "machine" && !isMeaningfulAttendancePunch(crmOut)) {
    merged.checkout_address = MACHINE_ATTENDANCE_ADDRESS;
    merged.checkout_latitude = null;
    merged.checkout_longitude = null;
  }

  if (checkinPick.source === "machine" && !isMeaningfulAttendancePunch(crmIn)) {
    if (!merged.checkin_address) merged.checkin_address = MACHINE_ATTENDANCE_ADDRESS;
  }

  if (
    machineOnlyCheckin &&
    isAutomaticCheckoutAddress(merged.checkout_address)
  ) {
    merged.checkout_address = isMeaningfulAttendancePunch(macOut)
      ? MACHINE_ATTENDANCE_ADDRESS
      : null;
    merged.checkout_latitude = null;
    merged.checkout_longitude = null;
    if (merged.auto_checkout_approval_status != null) {
      merged.auto_checkout_approval_status = null;
    }
  } else if (
    isAutomaticCheckoutAddress(merged.checkout_address) &&
    machineCheckoutIsBeforeNinePm(macOut, dateYmdForRow)
  ) {
    merged.checkout_address = isMeaningfulAttendancePunch(macOut)
      ? MACHINE_ATTENDANCE_ADDRESS
      : null;
    merged.checkout_latitude = null;
    merged.checkout_longitude = null;
    if (merged.auto_checkout_approval_status != null) {
      merged.auto_checkout_approval_status = null;
    }
  }

  return merged;
}

export async function loadMachineCodeMaps(conn) {
  await ensureRepListMachineCodeColumn(conn);
  const [profileRows] = await conn.query(
    `SELECT username, TRIM(machine_code) AS machine_code
     FROM rep_list
     WHERE status = 1
       AND TRIM(COALESCE(machine_code, '')) <> ''`
  );
  const usernameToMachineCode = new Map();
  const machineCodeToUsername = new Map();
  for (const row of profileRows || []) {
    const username = String(row.username || "").trim();
    const code = String(row.machine_code || "").trim();
    if (!username || !code) continue;
    usernameToMachineCode.set(username, code);
    if (!machineCodeToUsername.has(code)) {
      machineCodeToUsername.set(code, username);
    }
  }
  return { usernameToMachineCode, machineCodeToUsername };
}

/** emp_code (machine) → rep_list userRole / userDepartment via machine_code or empId. */
export async function loadRepListInfoByMachineEmpCode(conn) {
  await ensureRepListMachineCodeColumn(conn);
  const [rows] = await conn.query(
    `SELECT
       TRIM(machine_code) AS machine_code,
       TRIM(CAST(empId AS CHAR)) AS emp_id,
       userRole,
       userDepartment
     FROM rep_list
     WHERE status = 1`
  );
  const byCode = new Map();
  for (const row of rows || []) {
    const userRole = String(row.userRole ?? "").trim() || null;
    const userDepartment = String(row.userDepartment ?? "").trim() || null;
    const info = { userRole, userDepartment };
    const machineCode = String(row.machine_code || "").trim();
    const empId = String(row.emp_id ?? "").trim();
    if (machineCode && !byCode.has(machineCode)) byCode.set(machineCode, info);
    if (empId && !byCode.has(empId)) byCode.set(empId, info);
  }
  return byCode;
}

export function repListInfoForEmpCode(byCode, empCode) {
  const code = String(empCode ?? "").trim();
  if (!code || !byCode) return { userRole: null, userDepartment: null };
  return byCode.get(code) || { userRole: null, userDepartment: null };
}

export async function loadMachineDailyByUsername(conn, machineCodeToUsername) {
  await ensureMachineAttendancePunchesTable(conn);
  const [rows] = await conn.query(
    `SELECT
       emp_code,
       DATE(punch_datetime) AS punch_date,
       MIN(CASE WHEN HOUR(punch_datetime) < 12 THEN punch_datetime END) AS machine_checkin,
       MAX(CASE WHEN HOUR(punch_datetime) >= 12 THEN punch_datetime END) AS machine_checkout
     FROM machine_attendance_punches
     GROUP BY emp_code, DATE(punch_datetime)`
  );
  const byUserDate = new Map();
  for (const row of rows || []) {
    const empCode = String(row.emp_code || "").trim();
    const username = machineCodeToUsername.get(empCode);
    if (!username) continue;
    const dateYmd = attendanceDateKey(row.punch_date);
    if (!dateYmd) continue;
    byUserDate.set(`${username}|${dateYmd}`, {
      emp_code: empCode,
      punch_date: dateYmd,
      machine_checkin: row.machine_checkin,
      machine_checkout: row.machine_checkout,
    });
  }
  return byUserDate;
}

/**
 * Merge CRM attendance rows with machine punches (rep_list.machine_code → emp_code).
 * Adds machine-only rows when CRM has no log for that user/date.
 */
export function mergeAttendanceListWithMachine(crmRows, machineByUserDate) {
  const seen = new Set();
  const merged = [];

  for (const row of crmRows || []) {
    const dateYmd = attendanceDateKey(row.date);
    const key = `${row.username}|${dateYmd}`;
    seen.add(key);
    const machineDay = machineByUserDate.get(key) || null;
    merged.push(mergeCrmAndMachineDay(row, machineDay));
  }

  for (const [key, machineDay] of machineByUserDate.entries()) {
    if (seen.has(key)) continue;
    const [username, dateYmd] = key.split("|");
    const hasMachinePunch =
      isMeaningfulAttendancePunch(machineDay.machine_checkin) ||
      isMeaningfulAttendancePunch(machineDay.machine_checkout);
    if (!hasMachinePunch) continue;
    const synthetic = {
      username,
      date: dateYmd,
      checkin_time: null,
      checkout_time: null,
      checkin_address: null,
      checkout_address: null,
      admin_time_edit_remark: null,
      _syntheticMachineOnly: true,
    };
    merged.push(mergeCrmAndMachineDay(synthetic, machineDay));
  }

  merged.sort((a, b) => {
    const dc = attendanceDateKey(b.date).localeCompare(attendanceDateKey(a.date));
    if (dc !== 0) return dc;
    return String(a.username).localeCompare(String(b.username));
  });

  return merged;
}

export function formatAutoMachinePunchDateTime(dateYmd, wallTime = "21:00:00") {
  const t = String(wallTime || "21:00:00").trim();
  const normalized = /^\d{1,2}:\d{2}(:\d{2})?$/.test(t)
    ? t.length === 5
      ? `${t}:00`
      : t
    : "21:00:00";
  return `${dateYmd} ${normalized}`;
}

export async function insertAutoMachineCheckoutPunch(conn, {
  empCode,
  employeeName,
  dateYmd,
  wallTime,
}) {
  if (!empCode || !dateYmd) return false;
  const punchAt = formatAutoMachinePunchDateTime(dateYmd, wallTime);
  const sourceUid = `auto-9pm-${empCode}-${dateYmd}`;
  const [result] = await conn.execute(
    `INSERT INTO machine_attendance_punches
      (emp_code, employee_name, punch_datetime, m_flag, raw_punch_date, source_uid)
     VALUES (?, ?, ?, 'AUTO', ?, ?)
     ON DUPLICATE KEY UPDATE punch_datetime = VALUES(punch_datetime)`,
    [
      empCode,
      employeeName || empCode,
      punchAt,
      punchAt,
      sourceUid,
    ]
  );
  return Number(result?.affectedRows ?? 0) > 0;
}
