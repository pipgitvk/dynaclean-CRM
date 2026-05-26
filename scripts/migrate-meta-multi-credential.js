/**
 * Migration script for Meta Multi-Credential System
 * Creates MySQL tables for credentials, leads, and sync logs
 */

const { getDbConnection } = require('../src/lib/db');

async function migrate() {
  const conn = await getDbConnection();

  try {
    console.log('🚀 Starting Meta Multi-Credential migration...');

    // Create meta_credentials table
    console.log('Creating meta_credentials table...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS meta_credentials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_name VARCHAR(255) NOT NULL,
        verify_token VARCHAR(500) NOT NULL,
        page_id VARCHAR(255) NOT NULL,
        page_token TEXT NOT NULL,
        form_ids JSON NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        last_sync_at DATETIME NULL,
        last_sync_status ENUM('success', 'error', 'pending') DEFAULT 'pending',
        last_sync_message TEXT NULL,
        total_leads_fetched INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_is_active (is_active),
        INDEX idx_employee_name (employee_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ meta_credentials table created');

    // Create meta_leads table
    console.log('Creating meta_leads table...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS meta_leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        leadgen_id VARCHAR(255) NOT NULL UNIQUE,
        assigned_to VARCHAR(255) NOT NULL,
        employee_name VARCHAR(255) NOT NULL,
        form_id VARCHAR(255) NOT NULL,
        page_id VARCHAR(255) NOT NULL,
        lead_data JSON NOT NULL,
        field_data JSON NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_imported_to_crm TINYINT(1) DEFAULT 0,
        crm_customer_id INT NULL,
        ad_id VARCHAR(255) NULL,
        campaign_name VARCHAR(500) NULL,
        products_interest VARCHAR(500) NULL,
        INDEX idx_leadgen_id (leadgen_id),
        INDEX idx_assigned_to (assigned_to),
        INDEX idx_form_id (form_id),
        INDEX idx_created_at (created_at),
        INDEX idx_is_imported_to_crm (is_imported_to_crm)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ meta_leads table created');

    // Create meta_sync_logs table
    console.log('Creating meta_sync_logs table...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS meta_sync_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        credential_id INT NOT NULL,
        employee_name VARCHAR(255) NOT NULL,
        sync_type ENUM('cron', 'manual', 'webhook') NOT NULL,
        status ENUM('success', 'error', 'partial') NOT NULL,
        leads_fetched INT DEFAULT 0,
        leads_imported INT DEFAULT 0,
        leads_skipped INT DEFAULT 0,
        error_message TEXT NULL,
        sync_duration INT NULL,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        form_ids_processed JSON NULL,
        INDEX idx_credential_id (credential_id),
        INDEX idx_synced_at (synced_at),
        INDEX idx_status (status),
        FOREIGN KEY (credential_id) REFERENCES meta_credentials(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ meta_sync_logs table created');

    console.log('🎉 Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Add credentials via the admin panel');
    console.log('2. Configure your Meta webhook to point to /api/webhook/meta');
    console.log('3. Start the cron service (it will auto-start with the app)');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await conn.end();
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };
