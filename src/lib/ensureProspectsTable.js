import { getDbConnection } from "@/lib/db";

/** Same DDL as admin-dashboard/prospects/migration_create_prospects.sql */
const CREATE_PROSPECTS_TABLE = `
CREATE TABLE IF NOT EXISTS prospects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NULL,
  model TEXT NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  commitment_date DATE NULL,
  notes TEXT NULL,
  created_by VARCHAR(128) NULL,
  finalized_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_prospects_customer (customer_id),
  INDEX idx_prospects_order_id (order_id),
  INDEX idx_prospects_commitment (commitment_date),
  INDEX idx_prospects_created_by (created_by)
)`;

/**
 * Ensures the prospects table exists (CREATE IF NOT EXISTS).
 * Safe to call on each request; no-op when table already present.
 */
export async function ensureProspectsTable() {
  const conn = await getDbConnection();
  await conn.execute(CREATE_PROSPECTS_TABLE);
  try {
    await conn.execute(
      `ALTER TABLE prospects ADD COLUMN created_by VARCHAR(128) NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  try {
    await conn.execute(
      `ALTER TABLE prospects ADD INDEX idx_prospects_created_by (created_by)`,
    );
  } catch (e) {
    if (e?.errno !== 1061) throw e;
  }
  try {
    await conn.execute(`ALTER TABLE prospects ADD COLUMN notes TEXT NULL`);
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  try {
    await conn.execute(
      `ALTER TABLE prospects ADD COLUMN finalized_at TIMESTAMP NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  try {
    await conn.execute(
      `ALTER TABLE prospects MODIFY COLUMN model TEXT NOT NULL`,
    );
  } catch {
    /* already TEXT or cannot alter */
  }
  try {
    await conn.execute(
      `ALTER TABLE prospects ADD COLUMN order_id VARCHAR(64) NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  try {
    await conn.execute(
      `ALTER TABLE prospects ADD INDEX idx_prospects_order_id (order_id)`,
    );
  } catch (e) {
    if (e?.errno !== 1061) throw e;
  }
  try {
    await conn.execute(
      `ALTER TABLE prospects ADD COLUMN quote_number VARCHAR(100) NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  try {
    await conn.execute(
      `ALTER TABLE prospects ADD INDEX idx_prospects_quote_number (quote_number)`,
    );
  } catch (e) {
    if (e?.errno !== 1061) throw e;
  }
  try {
    await conn.execute(
      `ALTER TABLE prospects ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'open'`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
}
