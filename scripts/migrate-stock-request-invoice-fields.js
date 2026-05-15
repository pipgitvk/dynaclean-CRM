/**
 * Adds invoice_number and invoice_date columns to product_stock_request if missing.
 * Run from project root: npm run migrate:stock-request-invoice
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
    "ALTER TABLE product_stock_request ADD COLUMN invoice_number VARCHAR(191) NULL DEFAULT NULL COMMENT 'Supplier invoice number' AFTER net_amount",
    "ALTER TABLE product_stock_request ADD COLUMN invoice_date DATE NULL DEFAULT NULL COMMENT 'Supplier invoice date' AFTER invoice_number",
  ];

  for (const sql of statements) {
    const column = sql.match(/ADD COLUMN (\w+)/)?.[1];
    try {
      await conn.query(sql);
      console.log(`Added column: ${column}`);
    } catch (error) {
      if (error && error.errno === 1060) {
        console.log(`Column already exists, skipped: ${column}`);
      } else if (error && error.errno === 1146) {
        console.error("Table product_stock_request does not exist. Create it before running this migration.");
        await conn.end();
        process.exit(1);
      } else {
        throw error;
      }
    }
  }

  await conn.end();
  console.log("Done. Invoice columns verified.");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
