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

    // Check and add po_number column
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM neworder LIKE 'po_number'"
    );
    if (columns.length === 0) {
      await connection.execute(
        "ALTER TABLE neworder ADD COLUMN po_number VARCHAR(255) NULL DEFAULT NULL COMMENT 'PO Number / Gem Order Number' AFTER approval_status"
      );
      console.log("Added column: po_number");
    } else {
      console.log("Column po_number already exists");
    }

    // Check and add payment_date column
    const [columns2] = await connection.execute(
      "SHOW COLUMNS FROM neworder LIKE 'payment_date'"
    );
    if (columns2.length === 0) {
      await connection.execute(
        "ALTER TABLE neworder ADD COLUMN payment_date DATE NULL DEFAULT NULL COMMENT 'Payment Date' AFTER po_number"
      );
      console.log("Added column: payment_date");
    } else {
      console.log("Column payment_date already exists");
    }

    // Check and add transaction_id column
    const [columns3] = await connection.execute(
      "SHOW COLUMNS FROM neworder LIKE 'transaction_id'"
    );
    if (columns3.length === 0) {
      await connection.execute(
        "ALTER TABLE neworder ADD COLUMN transaction_id VARCHAR(255) NULL DEFAULT NULL COMMENT 'Transaction ID' AFTER payment_date"
      );
      console.log("Added column: transaction_id");
    } else {
      console.log("Column transaction_id already exists");
    }

    console.log("Done. Order PO and payment fields verified.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
