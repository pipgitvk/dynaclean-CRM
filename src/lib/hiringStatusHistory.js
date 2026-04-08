/**
 * Append rows to hr_hiring_entry_status_history (must exist — run migration).
 * @param {import('mysql2/promise').PoolConnection} conn
 */
export async function logHiringCreated(conn, entryId, statusAfter, actorUsername) {
  await conn.execute(
    `INSERT INTO hr_hiring_entry_status_history (entry_id, status_before, status_after, actor_username)
     VALUES (?, NULL, ?, ?)`,
    [entryId, statusAfter, actorUsername]
  );
}

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 */
export async function logHiringStatusChange(conn, entryId, statusBefore, statusAfter, actorUsername) {
  const a = String(statusBefore ?? "").trim();
  const b = String(statusAfter ?? "").trim();
  if (a === b) return;
  await conn.execute(
    `INSERT INTO hr_hiring_entry_status_history (entry_id, status_before, status_after, actor_username)
     VALUES (?, ?, ?, ?)`,
    [entryId, a || null, b, actorUsername]
  );
}
