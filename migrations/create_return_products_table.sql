-- Create Return Products Table
CREATE TABLE IF NOT EXISTS return_products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quotation_no VARCHAR(255) NOT NULL,
  invoice_no VARCHAR(255) NOT NULL,
  model_no VARCHAR(255) NOT NULL,
  serial_no VARCHAR(255) NOT NULL,
  pricing_total DECIMAL(18,2) DEFAULT 0,
  tracking_no VARCHAR(255) NULL,
  return_type ENUM('partial', 'full') DEFAULT 'partial',
  return_status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
  reason TEXT NULL,
  created_by INT NULL,
  updated_by INT NULL,
  customer_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_quotation_no (quotation_no),
  INDEX idx_invoice_no (invoice_no),
  INDEX idx_return_status (return_status),
  INDEX idx_created_at (created_at),
  INDEX idx_customer_id (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
