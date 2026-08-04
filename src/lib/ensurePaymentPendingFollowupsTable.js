import { getDbConnection } from "@/lib/db";

const CREATE_PAYMENT_PENDING_FOLLOWUPS_TABLE = `
CREATE TABLE IF NOT EXISTS payment_pending_followups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  customer_id VARCHAR(64) NULL,
  client_name TEXT NULL,
  company_name TEXT NULL,
  contact VARCHAR(64) NULL,
  created_by VARCHAR(128) NULL,
  followed_date DATETIME NULL,
  communication_mode VARCHAR(32) NULL,
  next_followup_date DATETIME NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ppf_order_id (order_id),
  INDEX idx_ppf_customer_id (customer_id),
  INDEX idx_ppf_followed_date (followed_date),
  INDEX idx_ppf_comm_mode (communication_mode),
  INDEX idx_ppf_next_followup_date (next_followup_date),
  INDEX idx_ppf_created_at (created_at)
)`;

export async function ensurePaymentPendingFollowupsTable() {
  const pool = await getDbConnection();
  
  try {
    await pool.execute(CREATE_PAYMENT_PENDING_FOLLOWUPS_TABLE);
  } catch (e) {
    console.error("Error creating table:", e?.message);
  }

  // Run all ALTER operations in parallel where possible to reduce connection hold time
  const alterOperations = [
    pool.execute(
      `ALTER TABLE payment_pending_followups ADD COLUMN followed_date DATETIME NULL`
    ).catch(e => e?.errno === 1060 ? null : Promise.reject(e)),
    
    pool.execute(
      `ALTER TABLE payment_pending_followups ADD COLUMN communication_mode VARCHAR(32) NULL`
    ).catch(e => e?.errno === 1060 ? null : Promise.reject(e)),
    
    pool.execute(
      `ALTER TABLE payment_pending_followups MODIFY COLUMN followed_date DATETIME NULL`
    ).catch(() => null),
    
    pool.execute(
      `ALTER TABLE payment_pending_followups ADD INDEX idx_ppf_followed_date (followed_date)`
    ).catch(e => e?.errno === 1061 ? null : Promise.reject(e)),
    
    pool.execute(
      `ALTER TABLE payment_pending_followups ADD INDEX idx_ppf_comm_mode (communication_mode)`
    ).catch(e => e?.errno === 1061 ? null : Promise.reject(e)),
    
    pool.execute(
      `ALTER TABLE payment_pending_followups MODIFY COLUMN next_followup_date DATETIME NULL`
    ).catch(() => null),
  ];

  try {
    await Promise.all(alterOperations);
  } catch (error) {
    console.error("Error in ALTER operations:", error?.message);
  }
}
