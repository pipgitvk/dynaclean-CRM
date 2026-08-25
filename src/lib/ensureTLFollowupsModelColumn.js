/**
 * TL list/filter pages read TL_followups.model; follow-up pages already auto-add it.
 * List pages call this once before querying so production DBs without the migration still work.
 */
export async function ensureTLFollowupsModelColumn(conn) {
  try {
    await conn.execute(
      `ALTER TABLE TL_followups ADD COLUMN model VARCHAR(255) NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e; // 1060 = duplicate column
  }
}
