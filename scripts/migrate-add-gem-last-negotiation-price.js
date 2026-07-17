// Database migration script for adding gem_last_negotiation_price field to products_list
const fs = require("fs");
const path = require("path");
const mysql = require('mysql2/promise');
const dns = require('dns').promises;

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

async function resolveDbHost() {
  const host = process.env.DB_HOST;
  if (!host) throw new Error("DB_HOST is missing in environment variables.");

  try {
    const { address } = await dns.lookup(host, { family: 4 });
    console.log(`✅ Resolved ${host} to IPv4: ${address}`);
    return address;
  } catch (err) {
    console.error("❌ Failed to resolve DB_HOST:", err);
    throw new Error("DNS resolution failed for DB_HOST");
  }
}

async function runMigration() {
  loadEnvFile();
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    console.error(
      "Missing DB_HOST, DB_USER, or DB_NAME. Add them to .env.local in the project root."
    );
    process.exit(1);
  }

  let connection;
  try {
    const host = await resolveDbHost();
    
    connection = await mysql.createConnection({
      host,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 1,
      dateStrings: true,
    });

    console.log("✅ Connected to database");

    // Add gem_last_negotiation_price column if it doesn't exist
    console.log("\n📋 Checking gem_last_negotiation_price column...");
    try {
      await connection.execute(
        `ALTER TABLE products_list ADD COLUMN gem_last_negotiation_price DECIMAL(10, 2) DEFAULT 0 AFTER gem_price`
      );
      console.log("✅ gem_last_negotiation_price column added successfully");
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log("✅ gem_last_negotiation_price column already exists");
      } else {
        throw err;
      }
    }

    console.log("\n🎉 All columns added successfully!");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log("\n✅ Database connection closed");
    }
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log("\n✅ Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  });
