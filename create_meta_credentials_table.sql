CREATE TABLE IF NOT EXISTS meta_credentials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_name VARCHAR(255) NULL,
  verify_token VARCHAR(255) NOT NULL,
  page_id VARCHAR(255) NOT NULL,
  page_token TEXT NOT NULL,
  form_ids JSON NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  last_sync_at DATETIME NULL,
  last_sync_status VARCHAR(50) NULL,
  last_sync_message TEXT NULL,
  total_leads_fetched INT DEFAULT 0,
  total_leads_imported INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_is_active (is_active),
  INDEX idx_employee_name (employee_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
