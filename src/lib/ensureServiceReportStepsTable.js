import { getDbConnection } from "@/lib/db";

const CREATE_SERVICE_REPORT_STEPS = `
CREATE TABLE IF NOT EXISTS service_report_steps (
  service_id INT NOT NULL PRIMARY KEY,
  video_360 VARCHAR(512) NULL,
  video_problem VARCHAR(512) NULL,
  video_damaged VARCHAR(512) NULL,
  video_completion VARCHAR(512) NULL,
  work_started_at DATETIME NULL,
  work_completed_at DATETIME NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`;

const VIDEO_COLUMNS = ["video_360", "video_problem", "video_damaged", "video_completion"];

export async function ensureServiceReportStepsTable() {
  const conn = await getDbConnection();
  await conn.execute(CREATE_SERVICE_REPORT_STEPS);

  const [columns] = await conn.execute(
    `SELECT COLUMN_NAME, DATA_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'service_report_steps'
       AND COLUMN_NAME IN (${VIDEO_COLUMNS.map(() => "?").join(",")})`,
    VIDEO_COLUMNS,
  );
  for (const column of columns) {
    if (String(column.DATA_TYPE).toLowerCase() === "text") continue;
    if (!VIDEO_COLUMNS.includes(column.COLUMN_NAME)) continue;
    await conn.execute(
      `ALTER TABLE service_report_steps MODIFY COLUMN ${column.COLUMN_NAME} TEXT NULL`,
    );
  }
  return conn;
}
