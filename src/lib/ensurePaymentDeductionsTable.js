import { getDbConnection } from "@/lib/db";

const CREATE_PAYMENT_DEDUCTIONS_TABLE = `
CREATE TABLE IF NOT EXISTS payment_deductions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(100) NOT NULL,
  deduction_type VARCHAR(50) NOT NULL COMMENT 'LD, SD, TDS, Others',
  remarks TEXT,
  amount DECIMAL(15, 2) DEFAULT 0,
  recorded_by VARCHAR(100),
  recorded_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  claimable TINYINT(1) DEFAULT 0,
  claim_status VARCHAR(20) DEFAULT 'not received',
  claim_received_date DATETIME NULL,
  INDEX idx_order_id (order_id),
  INDEX idx_recorded_date (recorded_date),
  INDEX idx_claimable (claimable),
  INDEX idx_claim_status (claim_status) 
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

export async function ensurePaymentDeductionsTable() {
  const pool = await getDbConnection();

  try {
    await pool.execute(CREATE_PAYMENT_DEDUCTIONS_TABLE);
  } catch (e) {
    console.error("Error creating payment_deductions table:", e?.message);
  }

  const alterOperations = [
    pool
      .execute(`ALTER TABLE payment_deductions ADD COLUMN claimable TINYINT(1) DEFAULT 0`)
      .catch((e) => (e?.errno === 1060 ? null : Promise.reject(e))),
    pool
      .execute(
        `ALTER TABLE payment_deductions ADD COLUMN claim_status VARCHAR(20) DEFAULT 'not received'`
      )
      .catch((e) => (e?.errno === 1060 ? null : Promise.reject(e))),
    pool
      .execute(`ALTER TABLE payment_deductions ADD COLUMN claim_received_date DATETIME NULL`)
      .catch((e) => (e?.errno === 1060 ? null : Promise.reject(e))),
  ];

  try {
    await Promise.all(alterOperations);
  } catch (error) {
    console.error("Error altering payment_deductions table:", error?.message);
  }
}
