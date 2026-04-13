function normNote(n) {
  if (n == null) return null;
  const s = String(n).trim();
  return s === "" ? null : s;
}

/**
 * Append rows to hr_hiring_entry_status_history (must exist — run migration).
 * @param {import('mysql2/promise').PoolConnection} conn
 */
export async function logHiringCreated(conn, entryId, statusAfter, actorUsername, note = null) {
  await conn.execute(
    `INSERT INTO hr_hiring_entry_status_history (entry_id, status_before, status_after, actor_username, note)
     VALUES (?, NULL, ?, ?, ?)`,
    [entryId, statusAfter, actorUsername, normNote(note)]
  );
}

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 */
export async function logHiringStatusChange(conn, entryId, statusBefore, statusAfter, actorUsername, note = null) {
  const a = String(statusBefore ?? "").trim();
  const b = String(statusAfter ?? "").trim();
  if (a === b) return;
  await conn.execute(
    `INSERT INTO hr_hiring_entry_status_history (entry_id, status_before, status_after, actor_username, note)
     VALUES (?, ?, ?, ?, ?)`,
    [entryId, a || null, b, actorUsername, normNote(note)]
  );
}

/**
 * Log when the note field changes but status stays the same.
 * @param {import('mysql2/promise').PoolConnection} conn
 */
export async function logHiringNoteUpdate(conn, entryId, status, actorUsername, note = null) {
  const s = String(status ?? "").trim();
  if (!s) return;
  await conn.execute(
    `INSERT INTO hr_hiring_entry_status_history (entry_id, status_before, status_after, actor_username, note)
     VALUES (?, ?, ?, ?, ?)`,
    [entryId, s, s, actorUsername, normNote(note)]
  );
}
