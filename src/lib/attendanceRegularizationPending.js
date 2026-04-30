let proxyColumnEnsured = false;

/** Ensures DB column for overtime/proxy submissions; safe to call repeatedly. */
export async function ensureProxySubmitterColumn(conn) {
  if (proxyColumnEnsured) return true;
  try {
    const [cols] = await conn.execute(
      "SHOW COLUMNS FROM attendance_regularization_requests LIKE 'proxy_submitter_username'"
    );
    if (cols.length === 0) {
      await conn.execute(
        `ALTER TABLE attendance_regularization_requests
         ADD COLUMN proxy_submitter_username VARCHAR(255) NULL DEFAULT NULL`
      );
    }
    proxyColumnEnsured = true;
    return true;
  } catch (e) {
    console.error("ensureProxySubmitterColumn:", e.message);
    return false;
  }
}

/**
 * Pending rows visible to a reporting manager: direct reportees' self-requests,
 * or requests submitted via overtime by one of their direct reports (escalated).
 * Binds: [...reportees, ...reportees] when useProxyRouting is true.
 */
export function pendingRegularizationWhereClause(reportees, useProxyRouting) {
  const ph = reportees.map(() => "?").join(", ");
  if (!useProxyRouting) {
    return {
      sql: `status = 'pending' AND username IN (${ph})`,
      params: reportees,
    };
  }
  return {
    sql: `status = 'pending' AND (
      (proxy_submitter_username IS NULL AND username IN (${ph}))
      OR (proxy_submitter_username IS NOT NULL AND proxy_submitter_username IN (${ph}))
    )`,
    params: [...reportees, ...reportees],
  };
}
