// Database migration script for adding delivery_remark column to neworder table
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env file not found");
  }
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

async function runMigration() {
  loadEnvFile();
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    throw new Error("Missing database environment variables");
  }

  const connection = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  try {
    console.log("🚀 Starting migration: add_delivery_remark column...");

    // Check if column already exists
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'neworder' AND COLUMN_NAME = 'delivery_remark'"
    );

    if (columns.length > 0) {
      console.log("✅ Column 'delivery_remark' already exists. Skipping migration.");
      return;
    }

    // Add the column
    await connection.execute(
      "ALTER TABLE neworder ADD COLUMN delivery_remark LONGTEXT NULL COMMENT 'Remark for delivery status update'"
    );

    console.log("✅ Successfully added 'delivery_remark' column to neworder table");
    console.log("🎉 Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run migration if executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log("✅ Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Migration script failed:", error);
      process.exit(1);
    });
}

module.exports = runMigration;
