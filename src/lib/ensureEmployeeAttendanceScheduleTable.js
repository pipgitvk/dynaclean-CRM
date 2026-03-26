import { getDbConnection } from "@/lib/db";

const TABLE = "employee_attendance_schedule";

const DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE} (
  username VARCHAR(255) NOT NULL PRIMARY KEY,
  checkin_time TIME NULL,
  break_morning TIME NULL,
  break_lunch TIME NULL,
  break_evening TIME NULL,
  checkout_time TIME NULL,
  morning_duration_minutes SMALLINT UNSIGNED NULL DEFAULT 15,
  lunch_duration_minutes SMALLINT UNSIGNED NULL DEFAULT 30,
  evening_duration_minutes SMALLINT UNSIGNED NULL DEFAULT 15,
  grace_period_minutes INT NULL,
  half_day_checkin_time TIME NULL,
  half_day_checkout_time TIME NULL,
  break_grace_period_minutes INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

/** Legacy installs: add columns if missing */
const EXTRA_COLUMNS = [
  ["grace_period_minutes", "INT NULL"],
  ["half_day_checkin_time", "TIME NULL"],
  ["half_day_checkout_time", "TIME NULL"],
  ["break_grace_period_minutes", "INT NULL"],
];

async function columnExists(conn, columnName) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [TABLE, columnName]
  );
  return rows.length > 0;
}

export async function ensureEmployeeAttendanceScheduleTable() {
  const conn = await getDbConnection();
  await conn.query(DDL);
  for (const [col, def] of EXTRA_COLUMNS) {
    const exists = await columnExists(conn, col);
    if (!exists) {
      try {
        await conn.query(`ALTER TABLE ${TABLE} ADD COLUMN ${col} ${def}`);
      } catch (e) {
        console.error(`ensureEmployeeAttendanceScheduleTable ADD ${col}:`, e.message);
      }
    }
  }
}
