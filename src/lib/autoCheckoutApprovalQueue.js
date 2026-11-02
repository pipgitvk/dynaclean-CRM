import { applyAutomaticCheckouts } from "@/lib/attendanceAutoCheckout";
import {
  AUTO_CHECKOUT_ATTENDANCE_ADDRESS,
  isAutomaticCheckoutAddress,
} from "@/lib/attendanceAutoCheckoutConstants";
import {
  findLeaveForUserOnDate,
  resolveAutoCheckoutForAttendanceDay,
} from "@/lib/attendanceAutoCheckoutLeave";
import { isMeaningfulAttendancePunch } from "@/lib/attendanceMeaningfulPunch";
import {
  loadMachineCodeMaps,
  loadMachineDailyByUsername,
  machineCheckoutIsBeforeNinePm,
} from "@/lib/attendanceMachineMerge";
import { ensureAttendanceAutoCheckoutApprovalsTable } from "@/lib/ensureAttendanceAutoCheckoutApprovalsTable";

function parseYmd(value) {
  if (!value || typeof value !== "string") return null;
  const s = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function checkoutTimeFromDb(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}:${String(value.getSeconds()).padStart(2, "0")}`;
  }
  const s = String(value).trim();
  const part = s.includes(" ") ? s.split(" ").pop() : s;
  const m = part.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return `${String(parseInt(m[1], 10)).padStart(2, "0")}:${m[2]}:${(m[3] || "00").padStart(2, "0")}`;
}

async function loadLeaveAndScheduleMaps(conn, fromDate, toDate) {
  const [leaves] = await conn.query(
    `SELECT username, from_date, to_date, leave_type, is_half_day, half_day_type,
            start_time, end_time, status
     FROM employee_leaves
     WHERE status IN ('pending', 'approved')
       AND from_date <= ?
       AND to_date >= ?`,
    [toDate || "2099-12-31", fromDate || "1970-01-01"],
  );
  const [scheduleRows] = await conn.query(
    `SELECT username, checkin_time, checkout_time, break_lunch,
            lunch_duration_minutes, half_day_checkin_time
     FROM employee_attendance_schedule`,
  );
  const scheduleByUser = new Map();
  for (const row of scheduleRows || []) {
    if (row?.username) scheduleByUser.set(row.username, row);
  }
  return { leaves, scheduleByUser };
}

function enrichAutoCheckoutRow(row, leaves, scheduleByUser) {
  const dateYmd = parseYmd(
    row.date instanceof Date
      ? row.date.toISOString().slice(0, 10)
      : String(row.date).slice(0, 10),
  );
  const leave = findLeaveForUserOnDate(leaves, row.username, dateYmd);
  const scheduleRow = scheduleByUser.get(row.username) || null;
  const resolved = resolveAutoCheckoutForAttendanceDay({
    leave,
    dateYmd,
    scheduleRow,
    checkinTime: row.checkin_time,
  });
  return {
    ...row,
    date: dateYmd,
    leave_status: leave?.status || null,
    leave_type: leave?.leave_type || null,
    suggested_checkout_time: resolved.wallTime,
    current_checkout_time: checkoutTimeFromDb(row.checkout_time),
    has_active_leave: Boolean(leave),
    skips_auto_checkout: resolved.skipAuto,
  };
}

/** Drop approval rows when attendance is no longer an unapproved automatic check-out. */
export async function pruneStaleAutoCheckoutApprovals(conn) {
  await conn.query(
    `DELETE ap FROM attendance_auto_checkout_approvals ap
     LEFT JOIN attendance_logs a
       ON a.username = ap.username AND a.date = ap.log_date
     WHERE a.username IS NULL
        OR TRIM(COALESCE(a.checkout_address, '')) <> ?
        OR a.checkout_time IS NULL
        OR TRIM(a.checkout_time) = ''`,
    [AUTO_CHECKOUT_ATTENDANCE_ADDRESS],
  );
}

export function qualifiesForAutoCheckoutApprovalQueue(row, statusFilter = "pending") {
  if (!isAutomaticCheckoutAddress(row.checkout_address)) return false;
  if (!isMeaningfulAttendancePunch(row.checkout_time)) return false;
  if (row.skips_auto_checkout) return false;
  if (row.suppressed_by_machine_checkout) return false;
  if (statusFilter === "pending" && row.has_active_leave) return false;
  return true;
}

async function fetchAutomaticCheckoutRows(conn, { fromDate, toDate, statusFilter }) {
  const params = [AUTO_CHECKOUT_ATTENDANCE_ADDRESS];
  let dateSql = "";
  if (fromDate) {
    dateSql += " AND a.date >= ?";
    params.push(fromDate);
  }
  if (toDate) {
    dateSql += " AND a.date <= ?";
    params.push(toDate);
  }

  let statusSql = "";
  if (statusFilter === "pending") {
    statusSql = " AND (ap.id IS NULL OR ap.status = 'pending')";
  } else if (statusFilter === "rejected") {
    statusSql = " AND ap.status = 'rejected'";
  } else if (statusFilter === "all") {
    statusSql = " AND (ap.id IS NULL OR ap.status IN ('pending', 'rejected'))";
  } else {
    statusSql = " AND (ap.id IS NULL OR ap.status = 'pending')";
  }

  const [rows] = await conn.query(
    `SELECT
      a.username,
      a.date,
      a.checkin_time,
      a.checkout_time,
      a.checkout_address,
      a.employee_id,
      a.machine_code,
      COALESCE(ap.status, 'pending') AS approval_status,
      ap.reviewed_by,
      ap.reviewed_at,
      ap.note
    FROM attendance_logs a
    LEFT JOIN attendance_auto_checkout_approvals ap
      ON ap.username = a.username AND ap.log_date = a.date
    WHERE TRIM(COALESCE(a.checkout_address, '')) = ?
      AND a.checkout_time IS NOT NULL
      AND TRIM(a.checkout_time) <> ''
    ${dateSql}
    ${statusSql}
    ORDER BY a.date DESC, a.username ASC
    LIMIT 500`,
    params,
  );
  return rows;
}

async function attachMachineSuppression(conn, items) {
  if (!items.length) return items;
  const { usernameToMachineCode, machineCodeToUsername } =
    await loadMachineCodeMaps(conn);
  const empCodes = new Set();
  for (const row of items) {
    const code = usernameToMachineCode.get(row.username);
    if (code) empCodes.add(code);
  }
  const machineByUserDate = await loadMachineDailyByUsername(
    conn,
    machineCodeToUsername,
    { empCodes: [...empCodes] },
  );
  return items.map((row) => {
    const key = `${row.username}|${row.date}`;
    const macOut = machineByUserDate.get(key)?.machine_checkout ?? null;
    return {
      ...row,
      suppressed_by_machine_checkout: machineCheckoutIsBeforeNinePm(
        macOut,
        row.date,
      ),
    };
  });
}

/**
 * Rows that still need automatic check-out HR action (after machine revert + stale cleanup).
 */
export async function buildAutoCheckoutApprovalItems(
  conn,
  { fromDate, toDate, statusFilter = "pending", runAutoCheckoutSync = true },
) {
  await ensureAttendanceAutoCheckoutApprovalsTable(conn);
  if (runAutoCheckoutSync) {
    await applyAutomaticCheckouts();
  }
  await pruneStaleAutoCheckoutApprovals(conn);

  const rawItems = await fetchAutomaticCheckoutRows(conn, {
    fromDate,
    toDate,
    statusFilter,
  });
  const { leaves, scheduleByUser } = await loadLeaveAndScheduleMaps(
    conn,
    fromDate,
    toDate,
  );
  let items = rawItems.map((row) =>
    enrichAutoCheckoutRow(row, leaves, scheduleByUser),
  );
  items = await attachMachineSuppression(conn, items);
  return items.filter((row) =>
    qualifiesForAutoCheckoutApprovalQueue(row, statusFilter),
  );
}
