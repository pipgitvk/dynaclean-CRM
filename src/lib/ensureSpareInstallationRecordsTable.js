let tableReady = false;

export async function ensureSpareInstallationRecordsTable(conn) {
  if (tableReady) return;

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS spare_installation_records (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      registered_spare_id BIGINT UNSIGNED NULL,
      serial_number VARCHAR(128) NULL,
      order_id VARCHAR(64) NULL,
      quote_number VARCHAR(128) NULL,
      spare_item_code VARCHAR(128) NULL,
      spare_item_name VARCHAR(255) NULL,
      customer_name VARCHAR(255) NULL,
      service_type VARCHAR(32) NOT NULL DEFAULT 'INSTALLATION',
      installation_address TEXT NOT NULL,
      site_person VARCHAR(255) NOT NULL,
      site_email VARCHAR(255) NOT NULL,
      site_contact VARCHAR(64) NOT NULL,
      assigned_to VARCHAR(128) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      service_record_id INT UNSIGNED NULL,
      created_by VARCHAR(128) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_sir_registered_spare (registered_spare_id),
      KEY idx_sir_serial (serial_number),
      KEY idx_sir_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  tableReady = true;
}