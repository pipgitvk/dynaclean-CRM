const SPARE_INSTALLATION_STATUS_COLS = [
  {
    name: "planned_date",
    ddl: "ADD COLUMN planned_date DATE NULL DEFAULT NULL",
  },
  {
    name: "completed_by",
    ddl: "ADD COLUMN completed_by VARCHAR(128) NULL DEFAULT NULL",
  },
  {
    name: "completed_date",
    ddl: "ADD COLUMN completed_date DATE NULL DEFAULT NULL",
  },
];

let ready = false;

export async function ensureSpareInstallationStatusColumns(conn) {
  if (ready) return;
  const db = conn;
  for (const col of SPARE_INSTALLATION_STATUS_COLS) {
    const [rows] = await db.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'spare_installation_records'
         AND COLUMN_NAME = ?`,
      [col.name],
    );
    if (!rows.length) {
      await db.execute(
        `ALTER TABLE spare_installation_records ${col.ddl}`,
      );
    }
  }
  ready = true;
}