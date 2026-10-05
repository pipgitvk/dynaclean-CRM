import { getDbConnection } from "@/lib/db";

const COLUMNS = [
  {
    name: "mail_sent",
    ddl: "TINYINT(1) NOT NULL DEFAULT 0",
  },
  {
    name: "final_feedback_on_call",
    ddl: "TEXT NULL",
  },
  {
    name: "service_rating",
    ddl: "TINYINT UNSIGNED NULL COMMENT '0-5 stars'",
  },
  {
    name: "service_followup_at",
    ddl: "DATETIME NULL",
  },
];

export async function ensureServiceRecordsFollowupColumns() {
  const conn = await getDbConnection();
  for (const col of COLUMNS) {
    const [rows] = await conn.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'service_records'
         AND COLUMN_NAME = ?`,
      [col.name]
    );
    if (!rows.length) {
      await conn.execute(
        `ALTER TABLE service_records ADD COLUMN ${col.name} ${col.ddl}`
      );
    }
  }
  return conn;
}
