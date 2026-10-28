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
  findLeaveForUserOnDate,
  resolveAutoCheckoutForAttendanceDay,
} from "@/lib/attendanceAutoCheckoutLeave";
import {
  insertAutoMachineCheckoutPunch,
  isMachineOnlyCheckinAttendanceDay,
  loadMachineCodeMaps,
  loadMachineDailyByUsername,
  machineCheckoutIsBeforeNinePm,
  mergeCrmAndMachineDay,
  mergedHasCheckout,
} from "@/lib/attendanceMachineMerge";
import { lookupAttendanceEmployeeIds } from "@/lib/ensureAttendanceLogsEmployeeColumns";

const MYSQL_AUTO_CHECKOUT_LOCK = "crm_attendance_auto_checkout";
const USER_AUTO_CHECKOUT_TTL_MS = 20000;
const recentUserAutoCheckout = new Map();
let autoCheckoutChain = Promise.resolve();

function clockHms(value) {
  if (value == null || value === "") return "";
  const match = String(value).trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}:${(match[3] || "00").padStart(2, "0")}`;
}

function automaticCheckoutTimeAlreadyMatches(checkoutValue, wallTime) {
  const stored = clockHms(checkoutValue);
  const target = clockHms(wallTime);
  return Boolean(stored && target && stored === target);
}

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

function autoCheckoutDateTimeForDate(dateYmd, wallTime = AUTO_CHECKOUT_WALL_TIME) {
  if (!dateYmd) return null;
  const t = String(wallTime || AUTO_CHECKOUT_WALL_TIME).trim();
  const normalized = t.length === 5 ? `${t}:00` : t;
  return `${dateYmd} ${normalized}`;
}

async function revertCrmAutomaticCheckoutForMachinePreference(
  conn,
  { username, dateYmd, machineDay, machineOnlyCheckin },
) {
  const macIn = machineDay?.machine_checkin ?? null;
  const [revertResult] = await conn.query(
    `UPDATE attendance_logs
     SET checkout_time = NULL,
         checkout_latitude = NULL,
         checkout_longitude = NULL,
         checkout_address = NULL,
         checkin_time = CASE
           WHEN ? = 1
             AND ? IS NOT NULL
             AND checkin_time IS NOT NULL
             AND TIME(checkin_time) = TIME(?)
           THEN NULL
           ELSE checkin_time
         END
     WHERE username = ?
       AND date = ?
       AND TRIM(COALESCE(checkout_address, '')) = ?`,
    [
      machineOnlyCheckin ? 1 : 0,
      macIn,
      macIn,
      username,
      dateYmd,
      AUTO_CHECKOUT_ATTENDANCE_ADDRESS,
    ]
  );

  await conn.query(
    `DELETE FROM attendance_auto_checkout_approvals
     WHERE username = ? AND log_date = ?`,
    [username, dateYmd]
  );

  return Number(revertResult?.affectedRows ?? 0);
}

/**
 * Apply system check-out at 9:00 PM IST when employee did not check out manually.
 * Uses one pool connection + MySQL advisory lock to avoid deadlocks with cron / parallel fetches.
 * @returns {Promise<number>} rows updated
 */
export async function applyAutomaticCheckouts(_connIgnored, options = {}) {
  const run = () =>
    withDeadlockRetry(() =>
      withDbConnection((conn) => applyAutomaticCheckoutsOnConn(conn, options))
    );
  // A full-company pass must not sit in front of one employee's page load.
  if (options.username) return run();
  return withAutoCheckoutMutex(run);
}

async function applyAutomaticCheckoutsOnConn(conn, options = {}) {
  const { username: filterUsername } = options;
  if (filterUsername) {
    const last = recentUserAutoCheckout.get(filterUsername) || 0;
    if (Date.now() - last < USER_AUTO_CHECKOUT_TTL_MS) return 0;
  }

  const [[lockRow]] = await conn.query(
    `SELECT GET_LOCK(?, ?) AS got`,
    [MYSQL_AUTO_CHECKOUT_LOCK, filterUsername ? 0 : 2]
  );
  if (!lockRow?.got) {
    return 0;
  }

  try {
    await ensureAttendanceCheckoutGpsTriggersAllowAdmin(conn);

    const nowIst = getISTDateTimeString();
    const todayIst = getISTDateString();

    const [leaves] = await conn.query(
      `SELECT username, from_date, to_date, leave_type, is_half_day, half_day_type,
              start_time, end_time, status
       FROM employee_leaves
       WHERE status IN ('pending', 'approved')`
    );

    const scheduleByUser = new Map();
    const [scheduleRows] = await conn.query(
      `SELECT username, checkin_time, checkout_time, break_lunch,
              lunch_duration_minutes, half_day_checkin_time
       FROM employee_attendance_schedule`
    );
    for (const row of scheduleRows || []) {
      if (row?.username) scheduleByUser.set(row.username, row);
    }

    let updated = 0;

    const { usernameToMachineCode, machineCodeToUsername } =
      await loadMachineCodeMaps(conn);
    let empCodes;
    if (filterUsername) {
      const codes = new Set();
      const direct = usernameToMachineCode.get(filterUsername);
      if (direct) codes.add(direct);
      for (const [code, user] of machineCodeToUsername) {
        if (user === filterUsername) codes.add(code);
      }
      empCodes = [...codes];
    }
    const machineByUserDate = await loadMachineDailyByUsername(
      conn,
      machineCodeToUsername,
      empCodes ? { empCodes } : {},
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
      sql += ` AND a.username = ?
        AND (
          a.checkout_time IS NULL
          OR a.checkout_time = ''
          OR (
            TRIM(COALESCE(a.checkout_address, '')) = ?
            AND TIME(a.checkout_time) <> TIME(?)
          )
        )`;
      params.push(
        filterUsername,
        AUTO_CHECKOUT_ATTENDANCE_ADDRESS,
        AUTO_CHECKOUT_WALL_TIME,
      );
    } else {
      sql += `
        AND a.checkin_time IS NOT NULL
        AND TRIM(a.checkin_time) <> ''
        AND (
          a.checkout_time IS NULL
          OR TRIM(a.checkout_time) = ''
          OR TRIM(COALESCE(a.checkout_address, '')) = ?
        )`;
      params.push(AUTO_CHECKOUT_ATTENDANCE_ADDRESS);
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
      const machineOnlyCheckin = isMachineOnlyCheckinAttendanceDay(crm, machineDay);
      const macOut = machineDay?.machine_checkout ?? null;

      const shouldRevertExistingAuto =
        crm &&
        isAutomaticCheckoutAddress(crm.checkout_address) &&
        (machineOnlyCheckin ||
          machineCheckoutIsBeforeNinePm(macOut, dateYmd));

      if (shouldRevertExistingAuto) {
        const n = await revertCrmAutomaticCheckoutForMachinePreference(conn, {
          username,
          dateYmd,
          machineDay,
          machineOnlyCheckin,
        });
        if (n > 0) {
          updated += n;
          crm.checkout_time = null;
          crm.checkout_address = null;
        }
      }

      if (machineOnlyCheckin) {
        continue;
      }

      const merged = mergeCrmAndMachineDay(
        crm || { username, date: dateYmd },
        machineDay
      );

      if (!isMeaningfulAttendancePunch(merged.checkin_time)) continue;

      const leave = findLeaveForUserOnDate(leaves, username, dateYmd);
      const scheduleRow = scheduleByUser.get(username) || null;
      const { wallTime, skipAuto } = resolveAutoCheckoutForAttendanceDay({
        leave,
        dateYmd,
        scheduleRow,
        checkinTime: merged.checkin_time,
      });

      const crmCheckout = crm?.checkout_time ?? null;
      const machineCheckout = machineDay?.machine_checkout ?? null;

      if (skipAuto) {
        if (isAutomaticCheckoutAddress(crm?.checkout_address)) {
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
        }
        continue;
      }

      const autoAt = autoCheckoutDateTimeForDate(dateYmd, wallTime);
      if (!autoAt || autoAt > nowIst) continue;

      if (mergedHasCheckout(crmCheckout, machineCheckout)) {
        if (
          isAutomaticCheckoutAddress(crm?.checkout_address) &&
          isMeaningfulAttendancePunch(crmCheckout) &&
          !automaticCheckoutTimeAlreadyMatches(crmCheckout, wallTime)
        ) {
          const [fixResult] = await conn.query(
            `UPDATE attendance_logs
             SET checkout_time = TIMESTAMP(?, ?),
                 checkout_latitude = NULL,
                 checkout_longitude = NULL
             WHERE username = ?
               AND date = ?
               AND TRIM(COALESCE(checkout_address, '')) = ?
               AND TIME(checkout_time) <> TIME(?)`,
            [
              dateYmd,
              wallTime,
              username,
              dateYmd,
              AUTO_CHECKOUT_ATTENDANCE_ADDRESS,
              wallTime,
            ]
          );
          if (fixResult?.affectedRows > 0) updated += fixResult.affectedRows;
        }
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
          wallTime,
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
            wallTime,
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
          wallTime,
        });
        if (punched) updated += 1;
      }
    }

    if (filterUsername) recentUserAutoCheckout.set(filterUsername, Date.now());
    return updated;
  } finally {
    try {
      await conn.query(`SELECT RELEASE_LOCK(?)`, [MYSQL_AUTO_CHECKOUT_LOCK]);
    } catch {
      /* ignore */
    }
  }
}
