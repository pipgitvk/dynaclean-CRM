-- Create payment_deductions table if it doesn't exist
CREATE TABLE IF NOT EXISTS payment_deductions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(100) NOT NULL,
  deduction_type VARCHAR(50) NOT NULL COMMENT 'LD, SD, TDS, Others',
  remarks TEXT,
  amount DECIMAL(15, 2) DEFAULT 0,
  recorded_by VARCHAR(100),
  recorded_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_recorded_date (recorded_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
