/** Ensures optional columns exist on third_party_service_engineers */
export async function ensureThirdPartyEngineerColumns(conn) {
  const statements = [
    `ALTER TABLE third_party_service_engineers ADD COLUMN IF NOT EXISTS attachments TEXT NULL COMMENT 'JSON array of {attachment_id, attachment_name, file_path}'`,
    `ALTER TABLE third_party_service_engineers ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) NULL`,
    `ALTER TABLE third_party_service_engineers ADD COLUMN IF NOT EXISTS secondary_contact_number VARCHAR(20) NULL`,
    `ALTER TABLE third_party_service_engineers ADD COLUMN IF NOT EXISTS service_charge DECIMAL(10, 2) NULL`,
  ];
  for (const sql of statements) {
    try {
      await conn.execute(sql);
    } catch (_) {
      /* column may already exist on older MySQL without IF NOT EXISTS */
    }
  }

  const legacyAlters = [
    `ALTER TABLE third_party_service_engineers ADD COLUMN secondary_contact_number VARCHAR(20) NULL`,
    `ALTER TABLE third_party_service_engineers ADD COLUMN service_charge DECIMAL(10, 2) NULL`,
  ];
  for (const sql of legacyAlters) {
    try {
      await conn.execute(sql);
    } catch (_) {}
  }
}
