import { getDbConnection } from "@/lib/db";

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS third_party_engineer_followups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  engineer_id INT NOT NULL,
  followed_date DATETIME NULL,
  communication_mode VARCHAR(32) NULL,
  next_followup_date DATETIME NULL,
  notes TEXT NOT NULL,
  created_by VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tpef_engineer_id (engineer_id),
  INDEX idx_tpef_next_followup_date (next_followup_date),
  INDEX idx_tpef_followed_date (followed_date),
  INDEX idx_tpef_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

export async function ensureThirdPartyEngineerFollowupsTable(conn) {
  const db = conn || (await getDbConnection());
  try {
    await db.execute(CREATE_TABLE);
  } catch (e) {
    console.error("Error creating third_party_engineer_followups table:", e?.message);
  }
}
