import { getDbConnection } from "@/lib/db";

const TABLE = "customers";
const COLUMNS = [
  { name: "service_status", definition: "VARCHAR(50) NULL" },
  { name: "service_stage", definition: "VARCHAR(100) NULL DEFAULT 'New'" },
  { name: "service_tags", definition: "VARCHAR(255) NULL" },
];

async function columnExists(conn, columnName) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [TABLE, columnName],
  );
  return rows.length > 0;
}

export async function ensureCustomersServiceColumns(conn) {
  const db = conn || (await getDbConnection());

  for (const column of COLUMNS) {
    if (await columnExists(db, column.name)) continue;
    try {
      await db.query(
        `ALTER TABLE ${TABLE} ADD COLUMN ${column.name} ${column.definition}`,
      );
    } catch (e) {
      if (e?.errno !== 1060) {
        console.error(
          `ensureCustomersServiceColumns ADD ${column.name}:`,
          e?.message || e,
        );
      }
    }
  }
}
