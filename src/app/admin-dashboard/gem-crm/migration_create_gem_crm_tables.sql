CREATE TABLE IF NOT EXISTS bids (
  bid_id INT NOT NULL AUTO_INCREMENT,
  bidding_platform VARCHAR(100) NULL,
  bid_number VARCHAR(100) NULL,
  gem_bid_no VARCHAR(100) NULL,
  bid_title TEXT NULL,
  bid_link TEXT NULL,
  bid_document TEXT NULL,
  item_category VARCHAR(255) NULL,
  organisation_id INT NULL,
  bid_start_date DATE NULL,
  bid_end_date DATE NULL,
  bid_open_date DATE NULL,
  bid_validity_days INT NULL,
  model_id VARCHAR(100) NULL,
  specification TEXT NULL,
  total_quantity INT NULL,
  bid_type VARCHAR(100) NULL,
  evaluation_method VARCHAR(100) NULL,
  estimated_bid_value DECIMAL(15,2) NULL DEFAULT 0,
  bid_value DECIMAL(15,2) NULL DEFAULT 0,
  emd_required ENUM('yes','no') NULL DEFAULT 'no',
  emd_amount DECIMAL(15,2) NULL DEFAULT 0,
  epbg_percentage DECIMAL(8,2) NULL DEFAULT 0,
  epbg_duration_months INT NULL,
  reverse_auction ENUM('yes','no') NULL DEFAULT 'no',
  turnover_required DECIMAL(15,2) NULL DEFAULT 0,
  oem_turnover_required DECIMAL(15,2) NULL DEFAULT 0,
  experience_required_years INT NULL,
  delivery_days INT NULL,
  inspection_required ENUM('yes','no') NULL DEFAULT 'no',
  technical_status VARCHAR(50) NULL DEFAULT 'pending',
  financial_status VARCHAR(50) NULL DEFAULT 'pending',
  bid_status VARCHAR(50) NULL DEFAULT 'new',
  assigned_employee_id INT NULL,
  dd_id INT NULL,
  remarks TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (bid_id),
  KEY idx_bids_assigned_employee_id (assigned_employee_id),
  KEY idx_bids_bid_status (bid_status),
  KEY idx_bids_created_at (created_at),
  KEY idx_bids_bid_end_date (bid_end_date),
  KEY idx_bids_dd_id (dd_id)
);

CREATE TABLE IF NOT EXISTS bid_documents (
  document_id INT NOT NULL AUTO_INCREMENT,
  bid_id INT NOT NULL,
  document_name VARCHAR(255) NULL,
  document_file TEXT NULL,
  document_type VARCHAR(100) NULL DEFAULT 'other',
  uploaded_by INT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id),
  KEY idx_bid_documents_bid_id (bid_id),
  CONSTRAINT fk_bid_documents_bid_id FOREIGN KEY (bid_id) REFERENCES bids (bid_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bid_logs (
  log_id INT NOT NULL AUTO_INCREMENT,
  bid_id INT NOT NULL,
  old_status VARCHAR(50) NULL,
  new_status VARCHAR(50) NULL,
  remarks TEXT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY idx_bid_logs_bid_id (bid_id),
  CONSTRAINT fk_bid_logs_bid_id FOREIGN KEY (bid_id) REFERENCES bids (bid_id) ON DELETE CASCADE
);

ALTER TABLE neworder ADD COLUMN bid_id INT NULL;
ALTER TABLE neworder ADD COLUMN bid_number VARCHAR(100) NULL;
ALTER TABLE neworder ADD COLUMN gem_bid_no VARCHAR(100) NULL;

-- Add bid_value column if it doesn't exist
ALTER TABLE bids ADD COLUMN bid_value DECIMAL(15,2) NULL DEFAULT 0;
ALTER TABLE neworder ADD COLUMN bidding_platform VARCHAR(100) NULL;
