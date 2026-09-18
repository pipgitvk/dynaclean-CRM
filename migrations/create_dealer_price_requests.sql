CREATE TABLE IF NOT EXISTS dealer_price_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  price_term VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  requested_by VARCHAR(128) NULL,
  review_note TEXT NULL,
  reviewed_by VARCHAR(128) NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dpr_customer (customer_id),
  INDEX idx_dpr_status (status),
  INDEX idx_dpr_created (created_at)
);

CREATE TABLE IF NOT EXISTS dealer_price_request_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  item_type VARCHAR(20) NOT NULL,
  product_id INT NOT NULL,
  product_code VARCHAR(64) NULL,
  approved_price DECIMAL(12,2) NULL,
  INDEX idx_dpri_request (request_id),
  INDEX idx_dpri_item (item_type, product_id)
);
