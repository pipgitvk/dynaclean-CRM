-- Create Return Items Table to store individual items for partial returns
CREATE TABLE IF NOT EXISTS return_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  return_id INT NOT NULL,
  quotation_no VARCHAR(255),
  item_code VARCHAR(255) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  price_per_unit DECIMAL(18,2) NOT NULL,
  total_price DECIMAL(18,2) NOT NULL,
  serial_no VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT,
  INDEX idx_return_id (return_id),
  INDEX idx_item_code (item_code),
  INDEX idx_quotation_no (quotation_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
