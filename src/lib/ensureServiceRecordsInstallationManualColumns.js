import { getDbConnection } from "@/lib/db";

let installationManualColumnsReady = false;

const COLUMNS = [
  {
    name: "installation_completion_date",
    ddl: "ADD COLUMN installation_completion_date DATE NULL",
  },
  {
    name: "completed_by_service_engineer",
    ddl: "ADD COLUMN completed_by_service_engineer VARCHAR(255) NULL",
  },
  {
    name: "google_feedback_collected",
    ddl: "ADD COLUMN google_feedback_collected VARCHAR(8) NULL COMMENT 'yes or no'",
  },
  {
    name: "google_feedback_collection",
    ddl: "ADD COLUMN google_feedback_collection VARCHAR(80) NULL",
  },
];

export async function ensureServiceRecordsInstallationManualColumns(conn) {
  if (installationManualColumnsReady) return;

  const db = conn || (await getDbConnection());
  for (const col of COLUMNS) {
    const [rows] = await db.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'service_records'
         AND COLUMN_NAME = ?`,
      [col.name],
    );
    if (!rows.length) {
      await db.execute(`ALTER TABLE service_records ${col.ddl}`);
    }
  }
  installationManualColumnsReady = true;
}