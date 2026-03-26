import { getDbConnection } from "@/lib/db";

const TABLE = "attendance_rules";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS ${TABLE} (
  id INT NOT NULL PRIMARY KEY DEFAULT 1,
  checkin_time TIME NOT NULL DEFAULT '09:30:00',
  checkout_time TIME NOT NULL DEFAULT '18:30:00',
  grace_period_minutes INT NOT NULL DEFAULT 15,
  half_day_checkin_time TIME NOT NULL DEFAULT '10:00:00',
  half_day_checkout_time TIME NOT NULL DEFAULT '18:14:00',
  break_morning_time TIME NOT NULL DEFAULT '11:15:00',
  break_lunch_time TIME NOT NULL DEFAULT '13:30:00',
  break_evening_time TIME NOT NULL DEFAULT '17:45:00',
  morning_break_duration_min INT NOT NULL DEFAULT 15,
  lunch_break_duration_min INT NOT NULL DEFAULT 30,
  evening_break_duration_min INT NOT NULL DEFAULT 15,
  break_grace_period_minutes INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const COLUMNS = [
  ["checkin_time", "TIME NOT NULL DEFAULT '09:30:00'"],
  ["checkout_time", "TIME NOT NULL DEFAULT '18:30:00'"],
  ["grace_period_minutes", "INT NOT NULL DEFAULT 15"],
  ["half_day_checkin_time", "TIME NOT NULL DEFAULT '10:00:00'"],
  ["half_day_checkout_time", "TIME NOT NULL DEFAULT '18:14:00'"],
  ["break_morning_time", "TIME NOT NULL DEFAULT '11:15:00'"],
  ["break_lunch_time", "TIME NOT NULL DEFAULT '13:30:00'"],
  ["break_evening_time", "TIME NOT NULL DEFAULT '17:45:00'"],
  ["morning_break_duration_min", "INT NOT NULL DEFAULT 15"],
  ["lunch_break_duration_min", "INT NOT NULL DEFAULT 30"],
  ["evening_break_duration_min", "INT NOT NULL DEFAULT 15"],
  ["break_grace_period_minutes", "INT NOT NULL DEFAULT 5"],
  ["updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"],
];

let ensured = false;

async function columnExists(conn, columnName) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [TABLE, columnName]
  );
  return rows.length > 0;
}

export async function ensureAttendanceRulesTable() {
  if (ensured) return;
  const conn = await getDbConnection();
  await conn.query(CREATE_SQL);

  for (const [col, def] of COLUMNS) {
    const exists = await columnExists(conn, col);
    if (!exists) {
      try {
        await conn.query(`ALTER TABLE ${TABLE} ADD COLUMN ${col} ${def}`);
      } catch (e) {
        console.error(`ensureAttendanceRulesTable ALTER add ${col}:`, e.message);
      }
    }
  }

  const [cnt] = await conn.query(`SELECT COUNT(*) AS c FROM ${TABLE}`);
  const n = cnt[0]?.c ?? 0;
  if (n === 0) {
    await conn.query(`INSERT INTO ${TABLE} (id) VALUES (1)`);
  }

  ensured = true;
}

/** Load single global row (id = 1) */
export async function loadGlobalAttendanceRulesRow(conn) {
  await ensureAttendanceRulesTable();
  const [rows] = await conn.query(
    `SELECT * FROM ${TABLE} WHERE id = 1 LIMIT 1`
  );
  if (!rows.length) {
    await conn.query(`INSERT INTO ${TABLE} (id) VALUES (1)`);
    const [again] = await conn.query(
      `SELECT * FROM ${TABLE} WHERE id = 1 LIMIT 1`
    );
    return again[0];
  }
  return rows[0];
}
