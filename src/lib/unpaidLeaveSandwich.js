import { dateToYmdKey } from "@/lib/salaryPayDaysFromAttendance";
import {
  calculateContinuousLeaveDays,
  holidayDateKeySet,
} from "@/lib/leaveContinuousDays";

function parseLocalYmd(ymd) {
  const p = String(ymd || "").slice(0, 10).split("-");
  if (p.length < 3) return null;
  const yy = Number(p[0]);
  const mm = Number(p[1]);
  const dd = Number(p[2]);
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  const d = new Date(yy, mm - 1, dd);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function normalizeLeaveYmd(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA");
}

function isSandwichDay(date, holidayKeys) {
  if (!date) return false;
  if (date.getDay() === 0) return true;
  return holidayKeys.has(dateToYmdKey(date));
}

/** Days strictly between end of earlier span and start of later span must be Sunday/holiday only. */
export function gapIsSandwichOnly(leftToYmd, rightFromYmd, holidays = []) {
  const holidayKeys = holidayDateKeySet(holidays);
  const leftTo = parseLocalYmd(leftToYmd);
  const rightFrom = parseLocalYmd(rightFromYmd);
  if (!leftTo || !rightFrom) return false;
  if (rightFrom <= leftTo) return true;

  const d = new Date(leftTo.getTime());
  d.setDate(d.getDate() + 1);
  while (d < rightFrom) {
    if (!isSandwichDay(d, holidayKeys)) return false;
    d.setDate(d.getDate() + 1);
  }
  return true;
}

/** Full-day leave types that use Sunday/holiday sandwich between separate applications. */
export const SANDWICH_LEAVE_TYPES = ["unpaid", "paid", "sick", "casual"];

/**
 * Expand leave span to include sandwiched Sundays/holidays between
 * this request and other pending/approved full-day leaves of the same type.
 */
export function expandUnpaidSandwichSpan(fromYmd, toYmd, existingLeaves, holidays = []) {
  let from = normalizeLeaveYmd(fromYmd);
  let to = normalizeLeaveYmd(toYmd);
  if (!from || !to) {
    return { from_date: from, to_date: to, mergeLeaveIds: [] };
  }
  if (to < from) {
    const t = to;
    to = from;
    from = t;
  }

  const mergeLeaveIds = new Set();

  const pool = (existingLeaves || [])
    .filter((row) => row && row.is_half_day != 1)
    .map((row) => ({
      id: row.id,
      from: normalizeLeaveYmd(row.from_date),
      to: normalizeLeaveYmd(row.to_date),
    }))
    .filter((row) => row.id != null && row.from && row.to);

  let changed = true;
  while (changed) {
    changed = false;
    for (const iv of pool) {
      if (mergeLeaveIds.has(iv.id)) continue;

      if (iv.to < from) {
        if (gapIsSandwichOnly(iv.to, from, holidays)) {
          from = iv.from < from ? iv.from : from;
          mergeLeaveIds.add(iv.id);
          changed = true;
        }
      } else if (iv.from > to) {
        if (gapIsSandwichOnly(to, iv.from, holidays)) {
          to = iv.to > to ? iv.to : to;
          mergeLeaveIds.add(iv.id);
          changed = true;
        }
      } else {
        from = iv.from < from ? iv.from : from;
        to = iv.to > to ? iv.to : to;
        mergeLeaveIds.add(iv.id);
        changed = true;
      }
    }
  }

  return {
    from_date: from,
    to_date: to,
    mergeLeaveIds: [...mergeLeaveIds],
    sandwichApplied: mergeLeaveIds.size > 0 || from !== normalizeLeaveYmd(fromYmd) || to !== normalizeLeaveYmd(toYmd),
  };
}

/** Pending apply: only approved neighbours count. Pending stays separate until approval. */
export function unpaidLeavesForApprovalSandwich(rows, currentLeaveId) {
  return (rows || []).filter((row) => {
    if (!row || row.is_half_day == 1) return false;
    if (row.status === "approved") return true;
    return Number(row.id) === Number(currentLeaveId);
  });
}

/**
 * Days that count against balance if this full-day application is submitted
 * (includes sandwich Sundays/holidays and pending/approved neighbours in the cluster).
 */
export function computeSandwichBalanceProjection({
  takenCount,
  existingRows,
  from_date,
  to_date,
  newApplicationDays,
  holidays = [],
}) {
  const previewPool = unpaidLeavesForPendingSandwichPreview(existingRows);
  const hypothetical = [
    ...previewPool,
    {
      id: -1,
      from_date,
      to_date,
      is_half_day: 0,
      status: "pending",
    },
  ];
  const sandwich = expandUnpaidSandwichSpan(
    from_date,
    to_date,
    hypothetical,
    holidays
  );
  const clusterDays = calculateContinuousLeaveDays(
    sandwich.from_date,
    sandwich.to_date,
    holidays
  ).totalDays;

  const mergedIds = new Set(
    (sandwich.mergeLeaveIds || []).map((id) => Number(id))
  );

  let approvedInCluster = 0;
  let pendingOutsideCluster = 0;

  for (const row of existingRows || []) {
    const rowDays = Number(row.total_days) || 0;
    if (row.is_half_day == 1) {
      if (row.status === "pending") pendingOutsideCluster += rowDays;
      continue;
    }
    const id = Number(row.id);
    if (mergedIds.has(id)) {
      if (row.status === "approved") approvedInCluster += rowDays;
    } else if (row.status === "pending") {
      pendingOutsideCluster += rowDays;
    }
  }

  const projectedCommitted =
    Number(takenCount || 0) -
    approvedInCluster +
    pendingOutsideCluster +
    clusterDays;

  return {
    projectedCommitted,
    clusterDays,
    balanceDaysForThisApplication: clusterDays,
    sandwichLinksExisting: mergedIds.size > 0,
  };
}

/** Preview: show calendar days while pending; after all linked leaves approved. */
export function unpaidLeavesForPendingSandwichPreview(rows) {
  return (rows || []).filter(
    (row) =>
      row &&
      row.is_half_day != 1 &&
      (row.status === "pending" || row.status === "approved")
  );
}

/**
 * On HR approval: merge sandwiched spans (approved + this row only).
 * @returns {{ handled: boolean, primaryId?: number, from_date?: string, to_date?: string, totalDays?: number, deleteIds?: number[] }}
 */
export function buildUnpaidSandwichApprovalUpdate(leave, poolRows, holidays) {
  if (!leave || leave.is_half_day == 1) {
    return { handled: false };
  }
  const sandwich = expandUnpaidSandwichSpan(
    leave.from_date,
    leave.to_date,
    poolRows,
    holidays
  );
  const { totalDays } = calculateContinuousLeaveDays(
    sandwich.from_date,
    sandwich.to_date,
    holidays
  );
  const ids = new Set([
    ...(sandwich.mergeLeaveIds || []).map((id) => Number(id)),
    Number(leave.id),
  ]);
  const primaryId = Math.min(...ids);
  const deleteIds = [...ids].filter((id) => id !== primaryId);

  if (deleteIds.length === 0 && !sandwich.sandwichApplied) {
    return { handled: false };
  }

  return {
    handled: true,
    primaryId,
    deleteIds,
    from_date: sandwich.from_date,
    to_date: sandwich.to_date,
    totalDays,
  };
}

/**
 * Merge already-approved/pending sandwich-linked rows (fixes legacy separate applications).
 * @returns {Promise<boolean>} true if any merge was applied
 */
export async function reconcileSandwichLeavesForUser(conn, username, holidays) {
  let merged = false;
  for (const leaveType of SANDWICH_LEAVE_TYPES) {
    const [rows] = await conn.execute(
      `SELECT id, from_date, to_date, is_half_day, status
       FROM employee_leaves
       WHERE username = ?
         AND leave_type = ?
         AND status IN ('pending', 'approved')
         AND is_half_day != 1`,
      [username, leaveType]
    );
    if (!rows || rows.length < 2) continue;

    for (const row of rows) {
      const plan = buildUnpaidSandwichApprovalUpdate(row, rows, holidays);
      if (!plan.handled || !plan.deleteIds?.length) continue;

      await conn.execute(
        `UPDATE employee_leaves
         SET from_date = ?, to_date = ?, total_days = ?, is_half_day = 0
         WHERE id = ?`,
        [plan.from_date, plan.to_date, plan.totalDays, plan.primaryId]
      );
      const placeholders = plan.deleteIds.map(() => "?").join(", ");
      await conn.execute(
        `DELETE FROM employee_leaves WHERE username = ? AND id IN (${placeholders})`,
        [username, ...plan.deleteIds]
      );
      merged = true;
      break;
    }
  }
  return merged;
}
