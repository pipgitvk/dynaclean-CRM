/**
 * Makes employee_profile_submissions.status VARCHAR so values like reassign/revision_requested save correctly.
 * Run: npm run migrate:profile-submission-status
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
    console.error("Missing DB_HOST, DB_USER, or DB_NAME in .env / .env.local");
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

  await conn.query(
    `ALTER TABLE employee_profile_submissions MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pending'`
  );
  console.log("status column is now VARCHAR(32). Values: pending, approved, rejected, reassign, revision_requested, ...");

  await conn.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
