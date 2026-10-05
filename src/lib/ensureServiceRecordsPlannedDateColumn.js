import { getDbConnection } from "@/lib/db";

export async function ensureServiceRecordsPlannedDateColumn() {
  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'service_records'
       AND COLUMN_NAME = 'planned_date'`
  );
  if (!rows.length) {
    await conn.execute(
      "ALTER TABLE service_records ADD COLUMN planned_date DATE NULL"
    );
  }
  return conn;
}
