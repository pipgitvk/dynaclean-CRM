import { getDbConnection } from "@/lib/db";

let ensured = false;

async function ensureColumn(conn, columnName, definition) {
  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'prospect_submissions'
       AND COLUMN_NAME = ?`,
    [columnName],
  );
  if (!cols.length) {
    await conn.query(
      `ALTER TABLE prospect_submissions ADD COLUMN ${columnName} ${definition}`,
    );
  }
}

export async function ensureProspectSubmissionsTable() {
  if (ensured) return;
  const conn = await getDbConnection();
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS prospect_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      submitted_by VARCHAR(255) NOT NULL,
      reporting_manager VARCHAR(255) NULL,
      notes TEXT NULL,
      pdf_path VARCHAR(1000) NOT NULL,
      pdf_original_name VARCHAR(255) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      acknowledgment_notes TEXT NULL,
      acknowledged_by VARCHAR(255) NULL,
      acknowledged_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_prospect_submissions_submitted_by (submitted_by),
      INDEX idx_prospect_submissions_reporting_manager (reporting_manager),
      INDEX idx_prospect_submissions_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumn(conn, "acknowledgment_notes", "TEXT NULL");
  await ensureColumn(conn, "acknowledged_by", "VARCHAR(255) NULL");
  await ensureColumn(conn, "acknowledged_at", "DATETIME NULL");

  ensured = true;
}
