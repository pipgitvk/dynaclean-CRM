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

const PRUNE_STALE_INTERVAL_MS = 10 * 60 * 1000;
let lastStalePruneAt = 0;

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

function dateKeyFromRow(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}

function resolveLeaveBounds(fromDate, toDate, rows) {
  let from = fromDate ? String(fromDate).trim() : "";
  let to = toDate ? String(toDate).trim() : "";
  if (!from || !to) {
    for (const row of rows || []) {
      const d = dateKeyFromRow(row.date);
      if (!d) continue;
      if (!from || d < from) from = d;
      if (!to || d > to) to = d;
    }
  }
  return {
    from: from || "1970-01-01",
    to: to || "2099-12-31",
  };
}

async function loadLeaveAndScheduleMaps(conn, fromDate, toDate, usernames) {
  const leaveTo = toDate || "2099-12-31";
  const leaveFrom = fromDate || "1970-01-01";
  const [leaves] = await conn.query(
    `SELECT username, from_date, to_date, leave_type, is_half_day, half_day_type,
            start_time, end_time, status
     FROM employee_leaves
     WHERE status IN ('pending', 'approved')
       AND from_date <= ?
       AND to_date >= ?`,
    [leaveTo, leaveFrom],
  );

  const scheduleByUser = new Map();
  const users = [...new Set((usernames || []).map((u) => String(u || "").trim()).filter(Boolean))];
  if (!users.length) {
    return { leaves, scheduleByUser };
  }
  const placeholders = users.map(() => "?").join(",");
  const [scheduleRows] = await conn.query(
    `SELECT username, checkin_time, checkout_time, break_lunch,
            lunch_duration_minutes, half_day_checkin_time
     FROM employee_attendance_schedule
     WHERE username IN (${placeholders})`,
    users,
  );
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

/** Drop stale non-approved rows, but retain approved records for audit history. */
export async function pruneStaleAutoCheckoutApprovals(conn) {
  await conn.query(
    `DELETE ap FROM attendance_auto_checkout_approvals ap
     LEFT JOIN attendance_logs a
       ON a.username = ap.username AND a.date = ap.log_date
     WHERE a.username IS NULL
        OR (
          ap.status <> 'approved'
          AND (
            TRIM(COALESCE(a.checkout_address, '')) <> ?
            OR a.checkout_time IS NULL
            OR TRIM(a.checkout_time) = ''
          )
        )`,
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

async function fetchAutomaticCheckoutRows(conn, {
  fromDate,
  toDate,
  statusFilter,
  username,
}) {
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
  const user = String(username || "").trim();
  if (user) {
    dateSql += " AND a.username = ?";
    params.push(user);
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
    WHERE a.checkout_address = ?
      AND a.checkout_time IS NOT NULL
      AND a.checkout_time <> ''
    ${dateSql}
    ${statusSql}
    ORDER BY a.date DESC, a.username ASC
    LIMIT 500`,
    params,
  );
  return rows;
}

async function attachMachineSuppression(conn, items, { fromDate, toDate } = {}) {
  if (!items.length) return items;
  const { usernameToMachineCode, machineCodeToUsername } =
    await loadMachineCodeMaps(conn);
  const empCodes = new Set();
  let minD = fromDate || "";
  let maxD = toDate || "";
  for (const row of items) {
    const code = usernameToMachineCode.get(row.username);
    if (code) empCodes.add(code);
    const d = dateKeyFromRow(row.date);
    if (d) {
      if (!minD || d < minD) minD = d;
      if (!maxD || d > maxD) maxD = d;
    }
  }
  const machineByUserDate = await loadMachineDailyByUsername(
    conn,
    machineCodeToUsername,
    {
      empCodes: [...empCodes],
      fromDate: minD || undefined,
      toDate: maxD || undefined,
    },
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
async function maybePruneStaleAutoCheckoutApprovals(conn) {
  const now = Date.now();
  if (now - lastStalePruneAt < PRUNE_STALE_INTERVAL_MS) return;
  lastStalePruneAt = now;
  await pruneStaleAutoCheckoutApprovals(conn);
}

export async function buildAutoCheckoutApprovalItems(
  conn,
  { fromDate, toDate, statusFilter = "pending", username },
) {
  await ensureAttendanceAutoCheckoutApprovalsTable(conn);
  await maybePruneStaleAutoCheckoutApprovals(conn);

  const rawItems = await fetchAutomaticCheckoutRows(conn, {
    fromDate,
    toDate,
    statusFilter,
    username,
  });
  const bounds = resolveLeaveBounds(fromDate, toDate, rawItems);
  const usernames = rawItems.map((r) => r.username);
  const { leaves, scheduleByUser } = await loadLeaveAndScheduleMaps(
    conn,
    bounds.from,
    bounds.to,
    usernames,
  );
  let items = rawItems.map((row) =>
    enrichAutoCheckoutRow(row, leaves, scheduleByUser),
  );
  items = await attachMachineSuppression(conn, items, {
    fromDate: bounds.from,
    toDate: bounds.to,
  });
  return items.filter((row) =>
    qualifiesForAutoCheckoutApprovalQueue(row, statusFilter),
  );
}
