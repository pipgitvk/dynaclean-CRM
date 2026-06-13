/**
 * Adds paid_amount and remaining_amount columns to both product_stock_request and spare_stock_request if missing.
 * Run from project root: node scripts/migrate-purchase-payment-fields.js
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

  const statements = [
    // For product_stock_request
    "ALTER TABLE product_stock_request ADD COLUMN paid_amount DECIMAL(16, 2) NOT NULL DEFAULT 0 COMMENT 'Total amount paid against this request' AFTER net_amount",
    "ALTER TABLE product_stock_request ADD COLUMN remaining_amount DECIMAL(16, 2) GENERATED ALWAYS AS (net_amount - paid_amount) STORED COMMENT 'Remaining amount to be paid' AFTER paid_amount",
    // For spare_stock_request
    "ALTER TABLE spare_stock_request ADD COLUMN paid_amount DECIMAL(16, 2) NOT NULL DEFAULT 0 COMMENT 'Total amount paid against this request' AFTER net_amount",
    "ALTER TABLE spare_stock_request ADD COLUMN remaining_amount DECIMAL(16, 2) GENERATED ALWAYS AS (net_amount - paid_amount) STORED COMMENT 'Remaining amount to be paid' AFTER paid_amount",
  ];

  for (const sql of statements) {
    const match = sql.match(/ADD COLUMN (\w+)/);
    const column = match?.[1];
    const table = sql.includes("product_stock_request") ? "product_stock_request" : "spare_stock_request";
    try {
      await conn.query(sql);
      console.log(`Added column ${column} to ${table}`);
    } catch (error) {
      if (error && error.errno === 1060) {
        console.log(`Column ${column} already exists in ${table}, skipped`);
      } else if (error && error.errno === 1146) {
        console.error(`Table ${table} does not exist`);
      } else {
        throw error;
      }
    }
  }

  await conn.end();
  console.log("Done. Payment fields verified.");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});