/**
 * Backfill machines_followup.service_id from service_records by serial_number.
 * Run from project root: node scripts/backfill-machines-followup-service-id.js
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const dns = require("dns").promises;

function loadEnvFile() {
  const root = process.cwd();
  for (const name of [".env.local", ".env"]) {
    const full = path.join(root, name);
    if (!fs.existsSync(full)) continue;
    const lines = fs.readFileSync(full, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
    return;
  }
}

async function main() {
  loadEnvFile();
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    console.error("Missing DB_HOST, DB_USER, or DB_NAME.");
    process.exit(1);
  }

  let host = DB_HOST;
  try {
    const { address } = await dns.lookup(DB_HOST, { family: 4 });
    host = address;
    console.log(`Resolved ${DB_HOST} -> ${host}`);
  } catch {
    console.log(`Using host as-is: ${DB_HOST}`);
  }

  const conn = await mysql.createConnection({
    host,
    user: DB_USER,
    password: DB_PASSWORD ?? "",
    database: DB_NAME,
  });

  const [[before]] = await conn.query(
    `SELECT COUNT(*) AS n FROM machines_followup WHERE service_id IS NULL`
  );
  console.log(`Rows with NULL service_id before: ${before.n}`);

  const [result] = await conn.query(`
    UPDATE machines_followup mf
    INNER JOIN (
      SELECT
        TRIM(serial_number) COLLATE utf8mb4_unicode_ci AS serial_key,
        MAX(service_id) AS service_id
      FROM service_records
      WHERE serial_number IS NOT NULL AND TRIM(serial_number) != ''
      GROUP BY TRIM(serial_number) COLLATE utf8mb4_unicode_ci
    ) sr ON TRIM(mf.serial_number) COLLATE utf8mb4_unicode_ci = sr.serial_key
    SET mf.service_id = sr.service_id
    WHERE mf.service_id IS NULL
  `);

  const [[after]] = await conn.query(
    `SELECT COUNT(*) AS n FROM machines_followup WHERE service_id IS NULL`
  );
  console.log(`Updated: ${result.affectedRows}`);
  console.log(`Rows with NULL service_id after: ${after.n}`);

  await conn.end();
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
