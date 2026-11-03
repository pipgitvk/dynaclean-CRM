/** Letterhead / billing-entity fields on invoices, quotations_records */

export const DOCUMENT_FROM_COMPANY_COLUMNS = [
  { name: "from_company", ddl: "VARCHAR(255) NULL DEFAULT NULL" },
  { name: "from_gst", ddl: "VARCHAR(50) NULL DEFAULT NULL" },
  { name: "from_address", ddl: "TEXT NULL" },
  { name: "from_mobile", ddl: "VARCHAR(50) NULL DEFAULT NULL" },
  { name: "from_email", ddl: "VARCHAR(255) NULL DEFAULT NULL" },
  { name: "from_state", ddl: "VARCHAR(100) NULL DEFAULT NULL" },
  { name: "logo_file", ddl: "VARCHAR(500) NULL DEFAULT NULL" },
  { name: "CIN_new", ddl: "VARCHAR(100) NULL DEFAULT NULL" },
];

const TABLES = ["invoices", "quotations_records"];

const ensured = new Set();

async function addColumnIfMissing(conn, table, column) {
  const col = column.name === "CIN_new" ? "`CIN_new`" : column.name;
  try {
    await conn.execute(
      `ALTER TABLE \`${table}\` ADD COLUMN ${col} ${column.ddl}`,
    );
  } catch (_) {
    /* column exists or table missing */
  }
}

/** @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} conn */
export async function ensureDocumentFromCompanyColumns(conn) {
  const key = TABLES.join(",");
  if (ensured.has(key)) return;

  for (const table of TABLES) {
    for (const column of DOCUMENT_FROM_COMPANY_COLUMNS) {
      await addColumnIfMissing(conn, table, column);
    }
  }

  ensured.add(key);
}
