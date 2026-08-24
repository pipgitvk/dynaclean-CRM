import { getDbConnection } from "@/lib/db";

const CREATE_SCHEDULE_VISIT_TABLE = `
CREATE TABLE IF NOT EXISTS schedule_visit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  contact VARCHAR(64) NULL,
  visit_address TEXT NOT NULL,
  purpose TEXT NOT NULL,
  scheduled_date DATETIME NOT NULL,
  visit_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  visited_by VARCHAR(128) NULL,
  visit_date DATETIME NULL,
  discussion_summary TEXT NULL,
  created_by VARCHAR(128) NOT NULL,
  approved_by VARCHAR(128) NULL,
  assigned_to VARCHAR(128) NULL,
  rejection_reason TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_schedule_visit_customer (customer_id),
  INDEX idx_schedule_visit_status (visit_status),
  INDEX idx_schedule_visit_created_by (created_by),
  INDEX idx_schedule_visit_assigned_to (assigned_to),
  INDEX idx_schedule_visit_scheduled_date (scheduled_date)
)`;

export async function ensureScheduleVisitTable() {
  const conn = await getDbConnection();
  await conn.execute(CREATE_SCHEDULE_VISIT_TABLE);
}
