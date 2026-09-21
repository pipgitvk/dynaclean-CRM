const LEGACY_CLEAR_MIGRATION_ID = "customer_notes_language_clear_en";

async function ensureSchemaMigrationsTable(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      id VARCHAR(64) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function hasMigration(conn, id) {
  await ensureSchemaMigrationsTable(conn);
  const [rows] = await conn.execute(
    "SELECT 1 FROM _schema_migrations WHERE id = ? LIMIT 1",
    [id],
  );
  return rows.length > 0;
}

async function markMigration(conn, id) {
  await conn.execute("INSERT INTO _schema_migrations (id) VALUES (?)", [id]);
}

export async function ensureCustomerNotesLanguageColumn(conn) {
  const [cols] = await conn.execute(
    "SHOW COLUMNS FROM customers LIKE 'notes_language'",
  );
  if (cols.length > 0) return;

  await conn.execute(
    "ALTER TABLE customers ADD COLUMN notes_language VARCHAR(10) NULL DEFAULT NULL AFTER address",
  );
}

export async function normalizeCustomerNotesLanguageDefault(conn) {
  const [cols] = await conn.execute(
    "SHOW COLUMNS FROM customers LIKE 'notes_language'",
  );
  if (cols.length === 0) return;

  const isNullable = cols[0]?.Null === "YES";
  const defaultValue = cols[0]?.Default;

  if (!isNullable || defaultValue === "en" || defaultValue === "") {
    await conn.execute(
      "ALTER TABLE customers MODIFY COLUMN notes_language VARCHAR(10) NULL DEFAULT NULL",
    );
  }

  const legacyCleared = await hasMigration(conn, LEGACY_CLEAR_MIGRATION_ID);
  if (!legacyCleared) {
    await conn.execute(
      "UPDATE customers SET notes_language = NULL WHERE notes_language IN ('', 'en')",
    );
    await markMigration(conn, LEGACY_CLEAR_MIGRATION_ID);
  }
}
