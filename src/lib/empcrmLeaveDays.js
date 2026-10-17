/** Days to count toward balance for one employee_leaves row (half-day = always 0.5). */
export function leaveDaysForBalanceRow(row) {
  const isHalf = row?.is_half_day == 1 || row?.is_half_day === true;
  if (isHalf) return 0.5;
  const n = Number(row?.total_days);
  if (Number.isFinite(n) && n > 0) return n;
  return 1;
}

export function sumLeaveDaysByStatus(rows, status) {
  return (rows || [])
    .filter((r) => r.status === status)
    .reduce((sum, r) => sum + leaveDaysForBalanceRow(r), 0);
}

/** Fix legacy rows where is_half_day=1 but total_days was stored as 0 or 1. */
export async function backfillHalfDayLeaveTotals(conn, username) {
  try {
    const [info] = await conn.execute(
      `UPDATE employee_leaves 
       SET total_days = 0.5 
       WHERE username = ? 
         AND is_half_day = 1 
         AND (total_days IS NULL OR total_days != 0.5)`,
      [username],
    );
    return info?.affectedRows || 0;
  } catch (err) {
    console.warn("[leave-days] half-day backfill failed:", err?.message || err);
    return 0;
  }
}
