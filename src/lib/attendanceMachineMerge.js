import { isMeaningfulAttendancePunch } from "@/lib/attendanceMeaningfulPunch";
import { parseAttendanceDateTime } from "@/lib/istDateTime";
import { ensureRepListMachineCodeColumn } from "@/lib/ensureRepListMachineCode";
import { ensureMachineAttendancePunchesTable } from "@/lib/ensureMachineAttendancePunchesTable";
export const MACHINE_ATTENDANCE_ADDRESS = "Machine";

function attendanceDateKey(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  }
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
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
  const crmIn = crmRow?.checkin_time ?? null;
  const crmOut = crmRow?.checkout_time ?? null;
  const macIn = machineDay?.machine_checkin ?? null;
  const macOut = machineDay?.machine_checkout ?? null;

  const checkinPick = pickEarlierCheckin(crmIn, macIn);
  const checkoutPick = pickLaterCheckout(crmOut, macOut);

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

export function formatAutoMachinePunchDateTime(dateYmd) {
  return `${dateYmd} 21:00:00`;
}

export async function insertAutoMachineCheckoutPunch(conn, {
  empCode,
  employeeName,
  dateYmd,
}) {
  if (!empCode || !dateYmd) return false;
  const punchAt = formatAutoMachinePunchDateTime(dateYmd);
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
