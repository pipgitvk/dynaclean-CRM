
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log("Connected to database!");

  try {
    // Add parent_id to spare_stock_request
    try {
      await conn.execute(`
        ALTER TABLE spare_stock_request 
        ADD COLUMN parent_id INT NULL DEFAULT NULL
      `);
      console.log("✅ Added parent_id to spare_stock_request");
    } catch (err) {
      if (err.code === "ER_DUP_FIELDNAME") {
        console.log("ℹ️ parent_id already exists in spare_stock_request");
      } else {
        throw err;
      }
    }

    // Add parent_id to product_stock_request
    try {
      await conn.execute(`
        ALTER TABLE product_stock_request 
        ADD COLUMN parent_id INT NULL DEFAULT NULL
      `);
      console.log("✅ Added parent_id to product_stock_request");
    } catch (err) {
      if (err.code === "ER_DUP_FIELDNAME") {
        console.log("ℹ️ parent_id already exists in product_stock_request");
      } else {
        throw err;
      }
    }

    console.log("\n✅ Migration completed!");
  } finally {
    await conn.end();
  }
}

main().catch(console.error);
