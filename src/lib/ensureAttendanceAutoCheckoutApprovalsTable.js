import { getDbConnection } from "@/lib/db";

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS attendance_auto_checkout_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  log_date DATE NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by VARCHAR(255) NULL,
  reviewed_at DATETIME NULL,
  note VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_auto_co_approval (username, log_date),
  INDEX idx_auto_co_status (status),
  INDEX idx_auto_co_log_date (log_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

export async function ensureAttendanceAutoCheckoutApprovalsTable(conn) {
  const db = conn || (await getDbConnection());
  try {
    await db.execute(CREATE_TABLE);
  } catch (e) {
    console.error("ensureAttendanceAutoCheckoutApprovalsTable:", e?.message);
    throw e;
  }
}
