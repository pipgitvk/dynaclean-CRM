// Database migration script for GEM CRM / Government Tender Management Module
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

    // Create bids table
    console.log("\n📋 Creating bids table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bids (
        bid_id INT PRIMARY KEY AUTO_INCREMENT,
        bidding_platform VARCHAR(100),
        bid_number VARCHAR(100) UNIQUE,
        gem_bid_no VARCHAR(100),
        bid_title VARCHAR(500),
        bid_link TEXT,
        bid_document VARCHAR(255),
        item_category VARCHAR(255),
        organisation_id INT,
        bid_start_date DATETIME,
        bid_end_date DATETIME,
        bid_open_date DATETIME,
        bid_validity_days INT,
        model_id INT,
        specification TEXT,
        total_quantity INT,
        bid_type VARCHAR(100),
        evaluation_method VARCHAR(255),
        estimated_bid_value DECIMAL(15,2),
        emd_required ENUM('yes','no') DEFAULT 'no',
        emd_amount DECIMAL(15,2),
        epbg_percentage DECIMAL(5,2),
        epbg_duration_months INT,
        reverse_auction ENUM('yes','no') DEFAULT 'no',
        turnover_required DECIMAL(15,2),
        oem_turnover_required DECIMAL(15,2),
        experience_required_years INT,
        delivery_days INT,
        inspection_required ENUM('yes','no') DEFAULT 'no',
        technical_status ENUM('pending','qualified','disqualified') DEFAULT 'pending',
        financial_status ENUM('pending','qualified','disqualified') DEFAULT 'pending',
        bid_status ENUM(
          'new',
          'under_review',
          'technical_preparation',
          'submitted',
          'technical_qualified',
          'ra_participated',
          'won',
          'lost',
          'cancelled'
        ) DEFAULT 'new',
        assigned_employee_id INT,
        dd_id INT,
        remarks TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_bid_number (bid_number),
        INDEX idx_gem_bid_no (gem_bid_no),
        INDEX idx_bid_status (bid_status),
        INDEX idx_technical_status (technical_status),
        INDEX idx_financial_status (financial_status),
        INDEX idx_assigned_employee (assigned_employee_id),
        INDEX idx_organisation (organisation_id),
        INDEX idx_created_by (created_by),
        INDEX idx_dd_id (dd_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ bids table created successfully");

    // Create bid_documents table
    console.log("\n📋 Creating bid_documents table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bid_documents (
        document_id INT PRIMARY KEY AUTO_INCREMENT,
        bid_id INT NOT NULL,
        document_name VARCHAR(255) NOT NULL,
        document_file VARCHAR(500) NOT NULL,
        document_type VARCHAR(100),
        uploaded_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bid_id) REFERENCES bids(bid_id) ON DELETE CASCADE,
        INDEX idx_bid_id (bid_id),
        INDEX idx_uploaded_by (uploaded_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ bid_documents table created successfully");

    // Create bid_logs table
    console.log("\n📋 Creating bid_logs table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bid_logs (
        log_id INT PRIMARY KEY AUTO_INCREMENT,
        bid_id INT NOT NULL,
        old_status VARCHAR(50),
        new_status VARCHAR(50),
        remarks TEXT,
        updated_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bid_id) REFERENCES bids(bid_id) ON DELETE CASCADE,
        INDEX idx_bid_id (bid_id),
        INDEX idx_updated_by (updated_by),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ bid_logs table created successfully");

    console.log("\n🎉 All GEM CRM tables created successfully!");

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
