-- Meta Credentials Table
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

-- Meta Form Assignments Table
CREATE TABLE IF NOT EXISTS meta_form_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  credential_id INT NOT NULL,
  form_id VARCHAR(255) NOT NULL,
  employee_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (credential_id) REFERENCES meta_credentials(id) ON DELETE CASCADE,
  INDEX idx_credential_form (credential_id, form_id),
  INDEX idx_employee_id (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Meta Leads Table
CREATE TABLE IF NOT EXISTS meta_leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  credential_id INT NOT NULL,
  lead_id VARCHAR(255) NOT NULL,
  form_id VARCHAR(255) NOT NULL,
  lead_data JSON NOT NULL,
  assigned_employee_id INT NULL,
  status VARCHAR(50) DEFAULT 'new',
  imported_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (credential_id) REFERENCES meta_credentials(id) ON DELETE CASCADE,
  INDEX idx_credential_id (credential_id),
  INDEX idx_lead_id (lead_id),
  INDEX idx_form_id (form_id),
  INDEX idx_assigned_employee (assigned_employee_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Meta Sync Logs Table
CREATE TABLE IF NOT EXISTS meta_sync_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  credential_id INT NOT NULL,
  sync_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  message TEXT NULL,
  leads_fetched INT DEFAULT 0,
  leads_imported INT DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (credential_id) REFERENCES meta_credentials(id) ON DELETE CASCADE,
  INDEX idx_credential_id (credential_id),
  INDEX idx_status (status),
  INDEX idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
