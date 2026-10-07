const COLUMNS = [
  {
    name: "assigned_to_type",
    ddl: "VARCHAR(50) DEFAULT 'internal' COMMENT 'internal, third_party'",
  },
  {
    name: "assigned_to_id",
    ddl: "INT NULL COMMENT 'legacy third-party engineer id'",
  },
  {
    name: "third_party_engineer_id",
    ddl: "INT NULL COMMENT 'third_party_service_engineers.engineer_id'",
  },
];

async function columnExists(conn, name) {
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'service_records'
       AND COLUMN_NAME = ?`,
    [name]
  );
  return rows.length > 0;
}

export async function ensureServiceRecordsThirdPartyAssignColumns(conn) {
  for (const col of COLUMNS) {
    if (await columnExists(conn, col.name)) continue;
    try {
      await conn.execute(
        `ALTER TABLE service_records ADD COLUMN ${col.name} ${col.ddl}`
      );
    } catch (e) {
      console.error(`ensureServiceRecordsThirdPartyAssignColumns ${col.name}:`, e?.message);
    }
  }
  try {
    await conn.execute(
      `ALTER TABLE service_records ADD INDEX idx_sr_third_party_engineer_id (third_party_engineer_id)`
    );
  } catch (_) {}
}
