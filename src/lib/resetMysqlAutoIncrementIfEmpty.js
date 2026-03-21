/** Whitelisted table names only — used in SQL identifiers. */
const TABLES = {
  client_expenses: "`client_expenses`",
  statements: "`statements`",
};

/**
 * When a table has no rows, reset AUTO_INCREMENT so the next INSERT uses id 1.
 * Do not call this inside a multi-statement transaction if other DDL might commit early;
 * run after COMMIT.
 *
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} conn
 * @param {"client_expenses" | "statements"} table
 */
export async function resetMysqlAutoIncrementIfEmpty(conn, table) {
  const quoted = TABLES[table];
  if (!quoted) return;
  const [rows] = await conn.execute(`SELECT COUNT(*) AS cnt FROM ${quoted}`);
  const cnt = Number(rows[0]?.cnt);
  if (cnt === 0) {
    await conn.execute(`ALTER TABLE ${quoted} AUTO_INCREMENT = 1`);
  }
}
