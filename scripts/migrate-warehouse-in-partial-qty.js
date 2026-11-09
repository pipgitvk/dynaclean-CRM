/**
 * Adds received_quantity to stock request tables for partial warehouse-in.
 * Run: node scripts/migrate-warehouse-in-partial-qty.js
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const ALTERS = [
  {
    table: "product_stock_request",
    sql: `ALTER TABLE product_stock_request
      ADD COLUMN received_quantity DECIMAL(16, 3) NOT NULL DEFAULT 0
      COMMENT 'Cumulative qty received via warehouse-in' AFTER quantity`,
  },
  {
    table: "spare_stock_request",
    sql: `ALTER TABLE spare_stock_request
      ADD COLUMN received_quantity DECIMAL(16, 3) NOT NULL DEFAULT 0
      COMMENT 'Cumulative qty received via warehouse-in' AFTER quantity`,
  },
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSOWRD,
    database: process.env.DB_NAME,
  });

  try {
    for (const { table, sql } of ALTERS) {
      try {
        await conn.execute(sql);
        console.log(`Added received_quantity on ${table}`);
      } catch (err) {
        if (err.code === "ER_DUP_FIELDNAME") {
          console.log(`received_quantity already on ${table}`);
        } else {
          throw err;
        }
      }
    }
    console.log("Migration done.");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
