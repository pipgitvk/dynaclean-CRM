-- Add return entries to ledger by storing return data
-- This will track when products are returned (partial or full)

-- We can use the existing ledger_entries table to store returns
-- The return status and date are already captured in invoices table

-- Optional: Create a dedicated return_ledger table for tracking returns separately
CREATE TABLE IF NOT EXISTS return_ledger_entries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  invoice_number VARCHAR(100) NULL,
  returned_date DATETIME NOT NULL,
  return_status ENUM('partial', 'full') NOT NULL,
  grand_total DECIMAL(18,2) NOT NULL,
  customer_name VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_returned_date (returned_date),
  INDEX idx_customer_name (customer_name)
);
