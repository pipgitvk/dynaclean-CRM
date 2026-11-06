let punchDateColumnReady = false;

/** Adds punch_date (CRM punch timestamp) and backfills from legacy created_at once. */
export async function ensureNeworderPunchDateColumn(conn) {
  if (punchDateColumnReady) return;

  const [cols] = await conn.execute(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'neworder'
       AND COLUMN_NAME = 'punch_date'
     LIMIT 1`,
  );

  if (!cols?.length) {
    await conn.execute(
      `ALTER TABLE neworder ADD COLUMN punch_date DATETIME NULL DEFAULT NULL COMMENT 'CRM punch/create timestamp'`,
    );
  }

  await conn.execute(
    `UPDATE neworder SET punch_date = created_at WHERE punch_date IS NULL AND created_at IS NOT NULL`,
  );

  punchDateColumnReady = true;
}
