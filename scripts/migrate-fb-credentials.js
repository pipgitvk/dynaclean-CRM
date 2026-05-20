/**
 * Creates FB_credentials table with single row for storing Facebook lead form credentials.
 * Run from project root: npm run migrate:fb-credentials
 * Requires DB_HOST, DB_USER, DB_PASSWORD, DB_NAME environment variables.
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
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
    return;
  }
}

async function main() {
  loadEnvFile();
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    console.error("Missing DB_HOST, DB_USER, or DB_NAME. Configure them in .env.local/.env.");
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

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS FB_credentials (
      id INT PRIMARY KEY AUTO_INCREMENT,
      FB_VERIFY_TOKEN VARCHAR(191) NULL DEFAULT NULL COMMENT 'Facebook webhook verify token',
      FB_PAGE_ID VARCHAR(191) NULL DEFAULT NULL COMMENT 'Facebook page ID',
      FB_PAGE_TOKEN TEXT NULL DEFAULT NULL COMMENT 'Facebook page access token',
      FB_LEAD_FORM_ID VARCHAR(191) NULL DEFAULT NULL COMMENT 'Facebook lead form ID',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

  try {
    await conn.query(createTableSQL);
    console.log("Table FB_credentials created successfully.");
  } catch (error) {
    if (error && error.errno === 1050) {
      console.log("Table FB_credentials already exists, skipped.");
    } else {
      throw error;
    }
  }

  await conn.end();
  console.log("Done. FB_credentials table verified.");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
