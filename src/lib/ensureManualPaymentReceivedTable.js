import { getDbConnection } from "@/lib/db";

const CREATE_MANUAL_PAYMENT_RECEIVED_TABLE = `
CREATE TABLE IF NOT EXISTS manual_payment_received (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT NOT NULL,
  payment_date DATE NULL,
  reference_number VARCHAR(128) NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  attachment_file VARCHAR(500) NULL,
  received_by VARCHAR(128) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mpr_payment_id (payment_id),
  INDEX idx_mpr_payment_date (payment_date)
)`;

export async function ensureManualPaymentReceivedTable() {
  const pool = await getDbConnection();

  try {
    await pool.execute(CREATE_MANUAL_PAYMENT_RECEIVED_TABLE);
  } catch (e) {
    console.error("Error creating manual_payment_received table:", e?.message);
  }
}
