-- MySQL: Create other_income table
CREATE TABLE IF NOT EXISTS other_income (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  income_name VARCHAR(255) NOT NULL,
  income_source VARCHAR(255) NOT NULL,
  income_category VARCHAR(100) NULL,
  amount DECIMAL(15, 2) NOT NULL,
  income_date DATE NOT NULL,
  transaction_date DATE NULL,
  description TEXT NULL,
  
  -- GST and Tax fields
  gst_applicable VARCHAR(10) NULL,
  gst_rate DECIMAL(5, 2) NULL,
  gst_amount DECIMAL(15, 2) NULL,
  tds_deducted VARCHAR(10) NULL,
  tds_amount DECIMAL(15, 2) NULL,
  
  -- Receipt/Payment details
  received_from VARCHAR(255) NULL,
  receipt_mode VARCHAR(50) NULL,
  bank_cash_account VARCHAR(255) NULL,
  
  -- Reference details
  reference_number VARCHAR(255) NULL,
  invoice_bill_number VARCHAR(255) NULL,
  
  -- File attachments
  receipt_attachment_path VARCHAR(500) NULL,
  proof_attachment_path VARCHAR(500) NULL,
  invoice_attachment_path VARCHAR(500) NULL,
  supporting_document_path VARCHAR(500) NULL,
  
  -- Additional fields
  remarks TEXT NULL,
  approval_status VARCHAR(50) DEFAULT 'Pending',
  
  -- Metadata
  username VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Linking to statements for ledger
  statement_id INT UNSIGNED NULL,
  
  INDEX idx_date (income_date),
  INDEX idx_username (username),
  INDEX idx_status (approval_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
