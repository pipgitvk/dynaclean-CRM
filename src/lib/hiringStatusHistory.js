function normNote(n) {
  if (n == null) return null;
  const s = String(n).trim();
  return s === "" ? null : s;
}

/**
 * Append rows to candidates_followups (must exist — run migration).
 * @param {import('mysql2/promise').PoolConnection} conn
 */
export async function logHiringCreated(conn, entryId, statusAfter, actorUsername, note = null) {
  await conn.execute(
    `INSERT INTO candidates_followups (entry_id, \`status\`, updated_by, note)
     VALUES (?, ?, ?, ?)`,
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
    `INSERT INTO candidates_followups (entry_id, \`status\`, updated_by, note)
     VALUES (?, ?, ?, ?)`,
    [entryId, b, actorUsername, normNote(note)]
  );
}

/**
 * Note-only edits: not stored in candidates_followups (table is status-only audit).
 * @param {import('mysql2/promise').PoolConnection} conn
 */
export async function logHiringNoteUpdate(_conn, _entryId, _status, _actorUsername, _note = null) {
  /* no-op: followups table stores status-only events */
}
