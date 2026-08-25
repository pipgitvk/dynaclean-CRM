/**
 * TL list/filter pages read TL_followups.model; follow-up pages already auto-add it.
 * Returns whether the column exists (attempts ADD if missing; never throws on ALTER failure).
 */
export async function ensureTLFollowupsModelColumn(conn) {
  const [existing] = await conn.execute(
    `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'TL_followups'
       AND COLUMN_NAME = 'model'
     LIMIT 1`,
  );
  if (existing.length > 0) return true;

  try {
    await conn.execute(
      `ALTER TABLE TL_followups ADD COLUMN model VARCHAR(255) NULL`,
    );
    return true;
  } catch (e) {
    if (e?.errno === 1060) return true; // duplicate column race
    console.error(
      "TL_followups.model missing and could not be added:",
      e?.code,
      e?.message,
    );
    return false;
  }
}
