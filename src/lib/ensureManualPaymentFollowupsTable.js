import { getDbConnection } from "@/lib/db";

const CREATE_MANUAL_PAYMENT_FOLLOWUPS_TABLE = `
CREATE TABLE IF NOT EXISTS manual_payment_followups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT NOT NULL,
  customer_name VARCHAR(255) NULL,
  customer_phone VARCHAR(64) NULL,
  created_by VARCHAR(128) NULL,
  followed_date DATETIME NULL,
  communication_mode VARCHAR(32) NULL,
  next_followup_date DATETIME NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mpf_payment_id (payment_id),
  INDEX idx_mpf_followed_date (followed_date),
  INDEX idx_mpf_next_followup_date (next_followup_date),
  INDEX idx_mpf_created_at (created_at)
)`;

export async function ensureManualPaymentFollowupsTable() {
  const pool = await getDbConnection();

  try {
    await pool.execute(CREATE_MANUAL_PAYMENT_FOLLOWUPS_TABLE);
  } catch (e) {
    console.error("Error creating manual_payment_followups table:", e?.message);
  }
}
