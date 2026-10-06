export async function ensureServiceRecordsThirdPartyAssignColumns(conn) {
  const statements = [
    `ALTER TABLE service_records ADD COLUMN IF NOT EXISTS assigned_to_type VARCHAR(50) DEFAULT 'internal' COMMENT 'internal, third_party'`,
    `ALTER TABLE service_records ADD COLUMN IF NOT EXISTS assigned_to_id INT NULL COMMENT 'legacy third-party engineer id'`,
    `ALTER TABLE service_records ADD COLUMN IF NOT EXISTS third_party_engineer_id INT NULL COMMENT 'third_party_service_engineers.engineer_id'`,
  ];
  for (const sql of statements) {
    try {
      await conn.execute(sql);
    } catch (_) {}
  }
  try {
    await conn.execute(
      `ALTER TABLE service_records ADD INDEX idx_sr_third_party_engineer_id (third_party_engineer_id)`
    );
  } catch (_) {}
}
