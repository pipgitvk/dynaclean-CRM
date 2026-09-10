-- Create Product Stock Edit History Table
CREATE TABLE IF NOT EXISTS product_stock_edit_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_code VARCHAR(100) NOT NULL,
  item_name VARCHAR(255),
  edited_by VARCHAR(100) NOT NULL,
  old_delhi INT,
  new_delhi INT,
  old_south INT,
  new_south INT,
  old_min_qty INT,
  new_min_qty INT,
  old_max_qty INT,
  new_max_qty INT,
  change_description TEXT,
  edited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_code (product_code),
  INDEX idx_edited_by (edited_by),
  INDEX idx_edited_at (edited_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
