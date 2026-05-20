const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  const root = path.resolve(__dirname, "..");
  const names = [".env.local", ".env"];
  for (const name of names) {
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

  const connection = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  try {
    console.log("Connected to database");

    // Check and add payment_amount column
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM neworder LIKE 'payment_amount'"
    );
    if (columns.length === 0) {
      await connection.execute(
        "ALTER TABLE neworder ADD COLUMN payment_amount DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Payment Amount' AFTER transaction_id"
      );
      console.log("Added column: payment_amount");
    } else {
      console.log("Column payment_amount already exists");
    }

    console.log("Done. Payment amount field verified.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
