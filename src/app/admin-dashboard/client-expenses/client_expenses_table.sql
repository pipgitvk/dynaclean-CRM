-- MySQL: Create client_expenses table
CREATE TABLE IF NOT EXISTS client_expenses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  expense_name VARCHAR(255) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  group_name VARCHAR(255) NULL,
  main_head ENUM('Direct', 'Indirect') NOT NULL DEFAULT 'Direct',
  head VARCHAR(255) NULL,
  supply VARCHAR(50) NULL,
  type_of_ledger VARCHAR(255) NULL,
  cgst DECIMAL(15, 2) NULL,
  sgst DECIMAL(15, 2) NULL,
  igst DECIMAL(15, 2) NULL,
  hsn VARCHAR(50) NULL,
  gst_rate DECIMAL(5, 2) NULL,
  amount DECIMAL(15, 2) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sub-heads: multiple add kar sakte ho (sirf sub_head field)
CREATE TABLE IF NOT EXISTS client_expense_sub_heads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_expense_id INT UNSIGNED NOT NULL,
  sub_head VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_expense_id) REFERENCES client_expenses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration: ALTER TABLE client_expenses DROP COLUMN sub_head; (if exists)
