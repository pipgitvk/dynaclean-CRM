import { isMeaningfulAttendancePunch } from "@/lib/attendanceMeaningfulPunch";
import { parseAttendanceDateTime } from "@/lib/istDateTime";
import { attendanceDateKey } from "@/lib/leaveDateRange";
import { ensureRepListMachineCodeColumn } from "@/lib/ensureRepListMachineCode";
import { ensureMachineAttendancePunchesTable } from "@/lib/ensureMachineAttendancePunchesTable";
import {
  loadRepListCanonicalUsernameMaps,
  resolveCanonicalUsername,
} from "@/lib/attendanceCanonicalUsername";
import { lookupAttendanceEmployeeIds } from "@/lib/ensureAttendanceLogsEmployeeColumns";
import { ensureAttendanceCheckoutGpsTriggersAllowAdmin } from "@/lib/ensureAttendanceCheckoutGpsTriggers";
import {
  AUTO_CHECKOUT_ATTENDANCE_ADDRESS,
  AUTO_CHECKOUT_WALL_TIME,
  isAutomaticCheckoutAddress,
} from "@/lib/attendanceAutoCheckoutConstants";
export const MACHINE_ATTENDANCE_ADDRESS = "Machine";

function isMachineAttendanceAddressValue(address) {
  return (
    String(address || "").trim().toLowerCase() ===
    MACHINE_ATTENDANCE_ADDRESS.toLowerCase()
  );
}

/**
 * Raw CRM app punches only (not merged display times).
 * Prefers crm_* fields after a prior merge pass; ignores Machine-address punches
 * that were written into attendance_logs from biometric sync.
 */
export function extractCrmPunchesFromAttendanceLogRow(crmRow) {
  if (!crmRow || crmRow._syntheticMachineOnly) {
    return { checkin: null, checkout: null };
  }

  let checkin = crmRow.crm_checkin_time ?? null;
  let checkout = crmRow.crm_checkout_time ?? null;

  if (!isMeaningfulAttendancePunch(checkin)) {
    const fromMachine =
      isMachineAttendanceAddressValue(crmRow.checkin_address) ||
      crmRow.merge_sources?.checkin === "machine";
    if (!fromMachine) {
      checkin = crmRow.checkin_time ?? null;
    }
  }

  if (!isMeaningfulAttendancePunch(checkout)) {
    const fromMachine =
      isMachineAttendanceAddressValue(crmRow.checkout_address) ||
      crmRow.merge_sources?.checkout === "machine";
    if (!fromMachine) {
      checkout = crmRow.checkout_time ?? null;
    }
  }

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

/** Raw MIN/MAX times stored in attendance_logs (before CRM vs machine merge). */
export function snapshotLogsTableTimes(crmRow) {
  if (!crmRow || crmRow._syntheticMachineOnly) {
    return { checkin: null, checkout: null };
  }
  return {
    checkin: isMeaningfulAttendancePunch(crmRow.checkin_time)
      ? crmRow.checkin_time
      : null,
    checkout: isMeaningfulAttendancePunch(crmRow.checkout_time)
      ? crmRow.checkout_time
      : null,
  };
}

export function combineLogsTableTimes(a, b) {
  return {
    checkin: pickEarlierCheckin(a?.checkin, b?.checkin).value,
    checkout: pickLaterCheckout(a?.checkout, b?.checkout).value,
  };
}

export function getLogsTableTimes(log) {
  if (log?.logs_table_times) return log.logs_table_times;
  return snapshotLogsTableTimes(log);
}

export function getMachinePunchTimes(log) {
  if (log?.machine_punch_times) return log.machine_punch_times;
  const md = log?.machine_day;
  return {
    checkin: isMeaningfulAttendancePunch(md?.machine_checkin)
      ? md.machine_checkin
      : null,
    checkout: isMeaningfulAttendancePunch(md?.machine_checkout)
      ? md.machine_checkout
      : null,
  };
}

/** Show separate Log + Machine lines when biometric data exists for this row. */
export function shouldShowLogAndMachineSourceLines(log) {
  const mp = getMachinePunchTimes(log);
  if (
    isMeaningfulAttendancePunch(mp.checkin) ||
    isMeaningfulAttendancePunch(mp.checkout)
  ) {
    return true;
  }
  return Boolean(String(log?.machine_code || "").trim());
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

  const logsTable = getLogsTableTimes(log);
  const machinePunches = getMachinePunchTimes(log);
  const machine = {
    checkin: machinePunches.checkin,
    checkout: machinePunches.checkout,
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
    isMeaningfulAttendancePunch(logsTable.checkin) ||
    isMeaningfulAttendancePunch(logsTable.checkout) ||
    isMeaningfulAttendancePunch(machine.checkin) ||
    isMeaningfulAttendancePunch(machine.checkout);
  return hasAny
    ? { crm, machine, logsTable, machinePunches: machine }
    : null;
}

function compareInstants(a, b) {
  const da = parseAttendanceDateTime(a);
  const db = parseAttendanceDateTime(b);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da.getTime() - db.getTime();
}

/** Display rule: earliest check-in wins (CRM vs machine). */
export function pickEarlierCheckin(crmVal, machineVal) {
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

/** Display rule: latest check-out wins (CRM vs machine). */
export function pickLaterCheckout(crmVal, machineVal) {
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

/**
 * Latest check-out for rules / merged row: CRM app, machine sync, and
 * attendance_logs table (Log line in UI) — baad wala time wins.
 */
export function pickLatestCheckoutForMerge(crmVal, machineVal, logsTableVal) {
  const base = pickLaterCheckout(crmVal, machineVal);
  if (!isMeaningfulAttendancePunch(logsTableVal)) {
    return base;
  }
  if (!isMeaningfulAttendancePunch(base.value)) {
    return { value: logsTableVal, source: "log" };
  }
  if (compareInstants(logsTableVal, base.value) > 0) {
    return { value: logsTableVal, source: "log" };
  }
  return base;
}

/** Rebuild a clean CRM base row before re-merging with machine (dedupe rematch). */
export function buildCrmBaseRowForRematch(crmRow) {
  if (!crmRow || crmRow._syntheticMachineOnly) {
    return {
      username: crmRow?.username,
      date: crmRow?.date,
      checkin_time: null,
      checkout_time: null,
      checkin_address: null,
      checkout_address: null,
      admin_time_edit_remark: null,
      _syntheticMachineOnly: true,
    };
  }
  const { checkin, checkout } = extractCrmPunchesFromAttendanceLogRow(crmRow);
  const logsTableTimes = snapshotLogsTableTimes(crmRow);
  return {
    ...crmRow,
    logs_table_times: logsTableTimes,
    checkin_time: checkin,
    checkout_time: checkout,
    crm_checkin_time: checkin,
    crm_checkout_time: checkout,
    merge_sources: undefined,
    attendance_sources_detail: undefined,
    machine_day: undefined,
    _syntheticMachineOnly: false,
  };
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

  const logsTableTimes =
    crmRow?.logs_table_times ?? snapshotLogsTableTimes(crmRow);

  const checkinPick = pickEarlierCheckin(crmIn, macIn);
  const checkoutPick = pickLatestCheckoutForMerge(
    crmOutForMerge,
    macOut,
    logsTableTimes.checkout,
  );
  const machinePunchTimes = {
    checkin: isMeaningfulAttendancePunch(macIn) ? macIn : null,
    checkout: isMeaningfulAttendancePunch(macOut) ? macOut : null,
  };

  const merged = {
    ...(crmRow || {}),
    logs_table_times: logsTableTimes,
    machine_punch_times: machinePunchTimes,
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

  if (
    !isMeaningfulAttendancePunch(crmOut) &&
    (checkoutPick.source === "machine" ||
      (checkoutPick.source === "log" &&
        isMachineAttendanceAddressValue(crmRow?.checkout_address)))
  ) {
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

/**
 * Last non-AUTO afternoon/evening punch of the day (ignores synthetic AUTO rows).
 * Used for CRM↔machine merge: later checkout wins vs CRM.
 */
export const MACHINE_CHECKOUT_AGG_SQL = `
  MAX(CASE
    WHEN TIME(punch_datetime) >= '12:00:00'
     AND UPPER(COALESCE(m_flag, '')) <> 'AUTO'
    THEN punch_datetime
  END)`;

export async function removeAutoNinePmMachinePunch(conn, empCode, dateYmd) {
  if (!empCode || !dateYmd) return 0;
  const sourceUid = `auto-9pm-${empCode}-${dateYmd}`;
  const [result] = await conn.execute(
    `DELETE FROM machine_attendance_punches WHERE source_uid = ?`,
    [sourceUid],
  );
  return Number(result?.affectedRows ?? 0);
}

/**
 * Write biometric check-out (before 9 PM) into attendance_logs; clears Automatic auto-checkout.
 * Does not overwrite a real CRM app check-out.
 */
export async function persistMachineCheckoutBeforeNinePm(
  conn,
  {
    username,
    dateYmd,
    machineCheckout,
    machineCheckin = null,
    ids = null,
  },
) {
  if (!username || !dateYmd || !machineCheckoutIsBeforeNinePm(machineCheckout, dateYmd)) {
    return 0;
  }

  await ensureAttendanceCheckoutGpsTriggersAllowAdmin(conn);

  const employeeIds = ids || (await lookupAttendanceEmployeeIds(conn, username));

  const [result] = await conn.query(
    `UPDATE attendance_logs
     SET checkin_time = COALESCE(checkin_time, ?),
         checkout_time = ?,
         checkout_latitude = NULL,
         checkout_longitude = NULL,
         checkout_address = ?
     WHERE username = ?
       AND date = ?
       AND (
         checkout_time IS NULL
         OR TRIM(checkout_time) = ''
         OR TRIM(COALESCE(checkout_address, '')) = ?
       )`,
    [
      machineCheckin,
      machineCheckout,
      MACHINE_ATTENDANCE_ADDRESS,
      username,
      dateYmd,
      AUTO_CHECKOUT_ATTENDANCE_ADDRESS,
    ],
  );

  let affected = Number(result?.affectedRows ?? 0);

  if (affected === 0) {
    const [ins] = await conn.query(
      `INSERT INTO attendance_logs
        (username, employee_id, machine_code, date, checkin_time, checkout_time, checkout_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        checkin_time = COALESCE(checkin_time, VALUES(checkin_time)),
        checkout_time = IF(
          checkout_time IS NULL OR TRIM(checkout_time) = ''
            OR TRIM(COALESCE(checkout_address, '')) = ?,
          VALUES(checkout_time),
          checkout_time
        ),
        checkout_address = IF(
          checkout_time IS NULL OR TRIM(checkout_time) = ''
            OR TRIM(COALESCE(checkout_address, '')) = ?,
          VALUES(checkout_address),
          checkout_address
        ),
        checkout_latitude = IF(
          checkout_time IS NULL OR TRIM(checkout_time) = ''
            OR TRIM(COALESCE(checkout_address, '')) = ?,
          NULL,
          checkout_latitude
        ),
        checkout_longitude = IF(
          checkout_time IS NULL OR TRIM(checkout_time) = ''
            OR TRIM(COALESCE(checkout_address, '')) = ?,
          NULL,
          checkout_longitude
        ),
        employee_id = COALESCE(employee_id, VALUES(employee_id)),
        machine_code = COALESCE(machine_code, VALUES(machine_code))`,
      [
        username,
        employeeIds.employee_id,
        employeeIds.machine_code,
        dateYmd,
        machineCheckin,
        machineCheckout,
        MACHINE_ATTENDANCE_ADDRESS,
        AUTO_CHECKOUT_ATTENDANCE_ADDRESS,
        AUTO_CHECKOUT_ATTENDANCE_ADDRESS,
        AUTO_CHECKOUT_ATTENDANCE_ADDRESS,
        AUTO_CHECKOUT_ATTENDANCE_ADDRESS,
      ],
    );
    affected = Number(ins?.affectedRows ?? 0) > 0 ? 1 : 0;
  }

  if (affected > 0) {
    await conn.query(
      `DELETE FROM attendance_auto_checkout_approvals
       WHERE username = ? AND log_date = ?`,
      [username, dateYmd],
    );
  }

  return affected;
}

export async function loadMachineCodeMaps(conn) {
  await ensureRepListMachineCodeColumn(conn);
  const canonicalMaps = await loadRepListCanonicalUsernameMaps(conn);
  const [profileRows] = await conn.query(
    `SELECT username, empId, TRIM(machine_code) AS machine_code
     FROM rep_list
     WHERE status = 1
       AND TRIM(COALESCE(machine_code, '')) <> ''`
  );
  const usernameToMachineCode = new Map();
  const machineCodeToUsername = new Map();
  for (const row of profileRows || []) {
    const code = String(row.machine_code || "").trim();
    if (!code) continue;
    const canon = resolveCanonicalUsername(row.username, canonicalMaps, {
      employee_id: row.empId,
      machine_code: code,
    });
    if (!canon) continue;
    usernameToMachineCode.set(canon, code);
    machineCodeToUsername.set(code, canon);
  }
  return {
    usernameToMachineCode,
    machineCodeToUsername,
    canonicalMaps,
    resolveCanonicalUsername: (username, extras = {}) =>
      resolveCanonicalUsername(username, canonicalMaps, extras),
  };
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

export async function loadMachineDailyByUsername(conn, machineCodeToUsername, options = {}) {
  await ensureMachineAttendancePunchesTable(conn);
  const empCodes = [
    ...new Set(
      (options.empCodes || []).map((code) => String(code || "").trim()).filter(Boolean),
    ),
  ];
  if (options.empCodes && empCodes.length === 0) return new Map();

  let sql = `
    SELECT
      emp_code,
      DATE(punch_datetime) AS punch_date,
      MIN(CASE WHEN HOUR(punch_datetime) < 12 THEN punch_datetime END) AS machine_checkin,
      ${MACHINE_CHECKOUT_AGG_SQL.trim()} AS machine_checkout
    FROM machine_attendance_punches`;
  const params = [];
  const where = [];
  if (empCodes.length) {
    where.push(`emp_code IN (${empCodes.map(() => "?").join(", ")})`);
    params.push(...empCodes);
  }
  const fromDate = String(options.fromDate || "").trim();
  const toDate = String(options.toDate || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    where.push(`punch_datetime >= ?`);
    params.push(`${fromDate} 00:00:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    where.push(`punch_datetime < DATE_ADD(?, INTERVAL 1 DAY)`);
    params.push(toDate);
  }
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += ` GROUP BY emp_code, DATE(punch_datetime)`;
  const [rows] = await conn.query(sql, params);
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
  const machineLookup = machineByUserDate || new Map();

  for (const row of crmRows || []) {
    const dateYmd = attendanceDateKey(row.date);
    const key = `${row.username}|${dateYmd}`;
    seen.add(key);
    const machineDay = machineLookup.get(key) || null;
    // Always merge through the picker so earliest in / latest out is applied.
    merged.push(mergeCrmAndMachineDay(buildCrmBaseRowForRematch(row), machineDay));
  }

  for (const [key, machineDay] of machineLookup.entries()) {
    if (seen.has(key)) continue;
    const pipe = key.indexOf("|");
    const username = pipe >= 0 ? key.slice(0, pipe) : key;
    const dateYmd = pipe >= 0 ? key.slice(pipe + 1) : "";
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
