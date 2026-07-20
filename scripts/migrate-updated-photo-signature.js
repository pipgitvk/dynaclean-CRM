
/**
 * Adds updated_profile_photo + updated_signature to employee_profile_submissions and employee_profiles if missing.
 * Run from project root: node scripts/migrate-updated-photo-signature.js
 * Requires DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (e.g. in .env or .env.local).
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
    console.error(
      "Missing DB_HOST, DB_USER, or DB_NAME. Add them to .env.local in the project root."
    );
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

  const stmts = [
    "ALTER TABLE employee_profile_submissions ADD COLUMN updated_profile_photo VARCHAR(500) NULL COMMENT 'Updated/reassigned profile photo URL'",
    "ALTER TABLE employee_profile_submissions ADD COLUMN updated_signature VARCHAR(500) NULL COMMENT 'Updated/reassigned signature URL'",
    "ALTER TABLE employee_profiles ADD COLUMN updated_profile_photo VARCHAR(500) NULL COMMENT 'Final approved updated profile photo URL'",
    "ALTER TABLE employee_profiles ADD COLUMN updated_signature VARCHAR(500) NULL COMMENT 'Final approved updated signature URL'",
  ];

  for (const sql of stmts) {
    const col = sql.match(/ADD COLUMN (\w+)/)?.[1];
    try {
      await conn.query(sql);
      console.log(`Added column: ${col}`);
    } catch (e) {
      if (e.errno === 1060) {
        console.log(`Already present, skipped: ${col}`);
      } else {
        throw e;
      }
    }
  }

  await conn.end();
  console.log("Done. Updated photo and signature columns should work now.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
