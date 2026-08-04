-- Create Credit Notes Table
CREATE TABLE IF NOT EXISTS credit_notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  credit_note_number VARCHAR(100) NOT NULL UNIQUE,
  order_id VARCHAR(100) NOT NULL,
  quote_number VARCHAR(255),
  invoice_no VARCHAR(255),
  return_id INT NULL,
  -- Credit Note To (customer)
  company_name VARCHAR(255),
  company_address TEXT,
  customer_gstin VARCHAR(100),
  customer_state VARCHAR(100),
  -- Credit Note Date fields
  credit_note_date DATE NOT NULL,
  invoice_date DATE,
  payment_date DATE,
  -- Items JSON
  items JSON,
  -- Amounts
  taxable_amount DECIMAL(20,2) DEFAULT 0,
  cgst_amount DECIMAL(20,2) DEFAULT 0,
  sgst_amount DECIMAL(20,2) DEFAULT 0,
  igst_amount DECIMAL(20,2) DEFAULT 0,
  total_tax DECIMAL(20,2) DEFAULT 0,
  grand_total DECIMAL(20,2) DEFAULT 0,
  -- Meta
  return_type ENUM('partial', 'full') DEFAULT 'partial',
  created_by VARCHAR(100),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_quote_number (quote_number),
  INDEX idx_credit_note_number (credit_note_number),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
