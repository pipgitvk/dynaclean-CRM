import { withDbConnection } from "@/lib/db";
import { getISTDateString, getISTDateTimeString } from "@/lib/istDateTime";
import { isMeaningfulAttendancePunch } from "@/lib/attendanceMeaningfulPunch";
import { ensureAttendanceCheckoutGpsTriggersAllowAdmin } from "@/lib/ensureAttendanceCheckoutGpsTriggers";
import {
  AUTO_CHECKOUT_ATTENDANCE_ADDRESS,
  AUTO_CHECKOUT_WALL_TIME,
  isAutomaticCheckoutAddress,
} from "@/lib/attendanceAutoCheckoutConstants";
import {
  autoCheckoutSkipKey,
  buildAutoCheckoutSkipKeySet,
} from "@/lib/attendanceAutoCheckoutLeave";
import {
  insertAutoMachineCheckoutPunch,
  loadMachineCodeMaps,
  loadMachineDailyByUsername,
  mergeCrmAndMachineDay,
  mergedHasCheckout,
} from "@/lib/attendanceMachineMerge";
import { lookupAttendanceEmployeeIds } from "@/lib/ensureAttendanceLogsEmployeeColumns";

const MYSQL_AUTO_CHECKOUT_LOCK = "crm_attendance_auto_checkout";
let autoCheckoutChain = Promise.resolve();

function isDeadlockError(err) {
  return err?.code === "ER_LOCK_DEADLOCK" || err?.errno === 1213;
}

function withAutoCheckoutMutex(fn) {
  const next = autoCheckoutChain.then(fn, fn);
  autoCheckoutChain = next.catch(() => {});
  return next;
}

async function withDeadlockRetry(fn, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isDeadlockError(err) || i >= attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 40 * (i + 1)));
    }
  }
  throw lastErr;
}

function attendanceDateKey(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** Only auto check-out time: attendance date + 9:00 PM IST (same for everyone). */
function autoCheckoutDateTimeForDate(dateYmd) {
  if (!dateYmd) return null;
  return `${dateYmd} ${AUTO_CHECKOUT_WALL_TIME}`;
}

/**
 * Apply system check-out at 9:00 PM IST when employee did not check out manually.
 * Uses one pool connection + MySQL advisory lock to avoid deadlocks with cron / parallel fetches.
 * @returns {Promise<number>} rows updated
 */
export async function applyAutomaticCheckouts(_connIgnored, options = {}) {
  return withAutoCheckoutMutex(() =>
    withDeadlockRetry(() =>
      withDbConnection((conn) => applyAutomaticCheckoutsOnConn(conn, options))
    )
  );
}

async function applyAutomaticCheckoutsOnConn(conn, options = {}) {
  const [[lockRow]] = await conn.query(
    `SELECT GET_LOCK(?, 2) AS got`,
    [MYSQL_AUTO_CHECKOUT_LOCK]
  );
  if (!lockRow?.got) {
    return 0;
  }

  try {
    await ensureAttendanceCheckoutGpsTriggersAllowAdmin(conn);

    const nowIst = getISTDateTimeString();
    const todayIst = getISTDateString();
    const { username: filterUsername } = options;
    const autoAddrLit = conn.escape(AUTO_CHECKOUT_ATTENDANCE_ADDRESS);

    const [leaves] = await conn.query(
      `SELECT username, from_date, to_date, leave_type, is_half_day, status
       FROM employee_leaves
       WHERE status = 'approved'`
    );
    const skipAutoCheckout = buildAutoCheckoutSkipKeySet(leaves);

    let normalizeSql = `
    UPDATE attendance_logs a
    INNER JOIN rep_list r
      ON a.username COLLATE utf8mb4_unicode_ci = r.username COLLATE utf8mb4_unicode_ci
    SET a.checkout_time = TIMESTAMP(a.date, ?),
        a.checkout_latitude = NULL,
        a.checkout_longitude = NULL
    WHERE r.status = 1
      AND TRIM(COALESCE(a.checkout_address, '')) = ${autoAddrLit}
      AND (
        a.checkout_time IS NULL
        OR TIME(a.checkout_time) <> TIME(?)
      )
  `;
    const normalizeParams = [AUTO_CHECKOUT_WALL_TIME, AUTO_CHECKOUT_WALL_TIME];
    if (filterUsername) {
      normalizeSql += ` AND a.username = ?`;
      normalizeParams.push(filterUsername);
    }
    const [normalizeResult] = await conn.query(normalizeSql, normalizeParams);
    let updated = normalizeResult?.affectedRows ?? 0;

    const { usernameToMachineCode, machineCodeToUsername } =
      await loadMachineCodeMaps(conn);
    const machineByUserDate = await loadMachineDailyByUsername(
      conn,
      machineCodeToUsername
    );

    let sql = `
    SELECT a.username, a.date, a.checkin_time, a.checkout_time, a.checkout_address
    FROM attendance_logs a
    INNER JOIN rep_list r
      ON a.username COLLATE utf8mb4_unicode_ci = r.username COLLATE utf8mb4_unicode_ci
    WHERE r.status = 1
      AND a.date <= ?
  `;
    const params = [todayIst];
    if (filterUsername) {
      sql += ` AND a.username = ?`;
      params.push(filterUsername);
    }

    const [crmRows] = await conn.query(sql, params);
    const candidates = [];
    const seen = new Set();

    for (const row of crmRows || []) {
      const dateYmd = attendanceDateKey(row.date);
      if (!dateYmd) continue;
      const key = `${row.username}|${dateYmd}`;
      seen.add(key);
      candidates.push({
        username: row.username,
        dateYmd,
        crm: row,
        machineDay: machineByUserDate.get(key) || null,
      });
    }

    for (const [key, machineDay] of machineByUserDate.entries()) {
      if (seen.has(key)) continue;
      const [username, dateYmd] = key.split("|");
      if (filterUsername && username !== filterUsername) continue;
      if (dateYmd > todayIst) continue;
      if (!isMeaningfulAttendancePunch(machineDay.machine_checkin)) continue;
      candidates.push({
        username,
        dateYmd,
        crm: null,
        machineDay,
      });
    }

    const displayNameByUser = new Map();
    const [allNames] = await conn.query(
      `SELECT username, username AS display_name FROM rep_list WHERE status = 1`
    );
    for (const n of allNames || []) {
      displayNameByUser.set(n.username, n.display_name || n.username);
    }

    for (const cand of candidates) {
      const { username, dateYmd, crm, machineDay } = cand;
      const merged = mergeCrmAndMachineDay(
        crm || { username, date: dateYmd },
        machineDay
      );

      if (!isMeaningfulAttendancePunch(merged.checkin_time)) continue;

      const skipKey = autoCheckoutSkipKey(username, dateYmd);
      const isHalfDayLeaveDay = skipAutoCheckout.has(skipKey);
      const crmCheckout = crm?.checkout_time ?? null;
      const machineCheckout = machineDay?.machine_checkout ?? null;

      if (
        isHalfDayLeaveDay &&
        isAutomaticCheckoutAddress(crm?.checkout_address)
      ) {
        const [revertResult] = await conn.query(
          `UPDATE attendance_logs
         SET checkout_time = NULL,
             checkout_latitude = NULL,
             checkout_longitude = NULL,
             checkout_address = NULL
         WHERE username = ?
           AND date = ?
           AND TRIM(COALESCE(checkout_address, '')) = ?`,
          [username, dateYmd, AUTO_CHECKOUT_ATTENDANCE_ADDRESS]
        );
        if (revertResult?.affectedRows > 0) updated += revertResult.affectedRows;
        continue;
      }

      if (isHalfDayLeaveDay) continue;

      const autoAt = autoCheckoutDateTimeForDate(dateYmd);
      if (!autoAt || autoAt > nowIst) continue;

      if (mergedHasCheckout(crmCheckout, machineCheckout)) continue;

      if (
        isAutomaticCheckoutAddress(crm?.checkout_address) &&
        isMeaningfulAttendancePunch(crmCheckout)
      ) {
        continue;
      }

      const checkinForRow = merged.checkin_time;

      const [result] = await conn.query(
        `UPDATE attendance_logs
       SET checkin_time = COALESCE(checkin_time, ?),
           checkout_time = TIMESTAMP(?, ?),
           checkout_latitude = NULL,
           checkout_longitude = NULL,
           checkout_address = ?
       WHERE username = ?
         AND date = ?
         AND (checkout_time IS NULL OR checkout_time = '')`,
        [
          checkinForRow,
          dateYmd,
          AUTO_CHECKOUT_WALL_TIME,
          AUTO_CHECKOUT_ATTENDANCE_ADDRESS,
          username,
          dateYmd,
        ]
      );

      if (result?.affectedRows === 0) {
        const ids = await lookupAttendanceEmployeeIds(conn, username);
        await conn.query(
          `INSERT INTO attendance_logs
            (username, employee_id, machine_code, date, checkin_time, checkout_time, checkout_address)
           VALUES (?, ?, ?, ?, ?, TIMESTAMP(?, ?), ?)
           ON DUPLICATE KEY UPDATE
            checkin_time = COALESCE(checkin_time, VALUES(checkin_time)),
            checkout_time = VALUES(checkout_time),
            checkout_address = VALUES(checkout_address),
            checkout_latitude = NULL,
            checkout_longitude = NULL,
            employee_id = COALESCE(employee_id, VALUES(employee_id)),
            machine_code = COALESCE(machine_code, VALUES(machine_code))`,
          [
            username,
            ids.employee_id,
            ids.machine_code,
            dateYmd,
            checkinForRow,
            dateYmd,
            AUTO_CHECKOUT_WALL_TIME,
            AUTO_CHECKOUT_ATTENDANCE_ADDRESS,
          ]
        );
        updated += 1;
      } else {
        updated += result.affectedRows;
      }

      const empCode = usernameToMachineCode.get(username);
      if (empCode) {
        const punched = await insertAutoMachineCheckoutPunch(conn, {
          empCode,
          employeeName: displayNameByUser.get(username) || username,
          dateYmd,
        });
        if (punched) updated += 1;
      }
    }

    return updated;
  } finally {
    try {
      await conn.query(`SELECT RELEASE_LOCK(?)`, [MYSQL_AUTO_CHECKOUT_LOCK]);
    } catch {
      /* ignore */
    }
  }
}
