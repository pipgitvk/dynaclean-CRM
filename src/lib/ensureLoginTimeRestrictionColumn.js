import { getDbConnection } from "@/lib/db";

const TABLES = ["rep_list", "emplist"];
const COLUMN = "login_time_restriction_enabled";

export async function columnExists(conn, table, columnName = COLUMN) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, columnName]
  );
  return rows.length > 0;
}

async function relaxSqlMode(conn) {
  await conn.query("SET @saved_sql_mode = @@SESSION.sql_mode");
  await conn.query(
    "SET SESSION sql_mode = 'NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION'"
  );
}

async function restoreSqlMode(conn) {
  try {
    await conn.query("SET SESSION sql_mode = @saved_sql_mode");
  } catch (_) {
    /* ignore */
  }
}

async function fixEmplistLegacyDefaults(conn) {
  if (!(await columnExists(conn, "emplist", "email_token_time"))) {
    return;
  }

  try {
    await relaxSqlMode(conn);
    await conn.query(
      "ALTER TABLE emplist MODIFY COLUMN email_token_time datetime DEFAULT NULL"
    );
    await restoreSqlMode(conn);
  } catch (e) {
    await restoreSqlMode(conn);
    console.error("ensureLoginTimeRestrictionColumn fix emplist.email_token_time:", e.message);
  }
}

async function addColumn(conn, table) {
  if (await columnExists(conn, table, COLUMN)) {
    return true;
  }

  const alterSql = `ALTER TABLE ${table} ADD COLUMN ${COLUMN} TINYINT(1) NOT NULL DEFAULT 1`;

  const runAlter = async () => {
    await conn.query(alterSql);
  };

  try {
    await runAlter();
  } catch (e) {
    const msg = String(e?.message || "");
    const errno = e?.errno;

    if (errno === 1060) {
      return true;
    }

    if (msg.includes("Invalid default value") || msg.includes("email_token_time")) {
      try {
        await relaxSqlMode(conn);
        await runAlter();
        await restoreSqlMode(conn);
      } catch (e2) {
        await restoreSqlMode(conn);
        console.error(
          `ensureLoginTimeRestrictionColumn ADD ${table}.${COLUMN} (sql_mode retry):`,
          e2.message
        );
        return false;
      }
    } else {
      console.error(`ensureLoginTimeRestrictionColumn ADD ${table}.${COLUMN}:`, msg);
      return false;
    }
  }

  try {
    await conn.query(
      `UPDATE ${table} SET ${COLUMN} = 0 WHERE LOWER(username) IN ('vk', 'admin')`
    );
  } catch (e) {
    console.error(`ensureLoginTimeRestrictionColumn legacy exempt ${table}:`, e.message);
  }

  return true;
}

export async function ensureLoginTimeRestrictionColumn() {
  const conn = await getDbConnection();
  await fixEmplistLegacyDefaults(conn);

  const results = {};

  for (const table of TABLES) {
    results[table] = await addColumn(conn, table);
  }

  return results;
}

export async function updateLoginTimeRestriction(conn, table, enabled, username) {
  if (!(await columnExists(conn, table, COLUMN))) {
    return { affectedRows: 0, skipped: true };
  }

  const [result] = await conn.execute(
    `UPDATE ${table} SET ${COLUMN} = ? WHERE username = ?`,
    [enabled, username]
  );
  return result;
}
