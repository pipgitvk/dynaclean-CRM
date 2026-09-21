-- Prospects module: MySQL table `prospects` (logical name: Prospects).
-- Optional: the app also runs CREATE TABLE IF NOT EXISTS via ensureProspectsTable()
-- on list/add. Use this file for manual DBA setup or when the DB user cannot CREATE.

CREATE TABLE IF NOT EXISTS prospects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NULL,
  model TEXT NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  commitment_date DATE NULL,
  notes TEXT NULL,
  created_by VARCHAR(128) NULL,
  finalized_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_prospects_customer (customer_id),
  INDEX idx_prospects_order_id (order_id),
  INDEX idx_prospects_commitment (commitment_date),
  INDEX idx_prospects_created_by (created_by)
);
