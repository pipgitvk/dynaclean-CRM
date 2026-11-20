async function columnExists(conn, name) {
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'service_records'
       AND COLUMN_NAME = ?`,
    [name],
  );
  return rows.length > 0;
}

/** Username of the user who last assigned service / third-party engineer on this record. */
export async function ensureServiceRecordsEngineerAssignedByColumn(conn) {
  if (await columnExists(conn, "engineer_assigned_by")) return;
  try {
    await conn.execute(
      `ALTER TABLE service_records
       ADD COLUMN engineer_assigned_by VARCHAR(255) NULL
       COMMENT 'User who assigned service engineer (internal or third party)'
       AFTER assigned_to`,
    );
  } catch (e) {
    console.error("ensureServiceRecordsEngineerAssignedByColumn:", e?.message);
  }
}