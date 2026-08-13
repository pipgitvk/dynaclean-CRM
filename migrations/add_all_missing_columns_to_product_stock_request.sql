-- Add all missing columns to product_stock_request table
ALTER TABLE product_stock_request
  ADD COLUMN IF NOT EXISTS product_code VARCHAR(100) NULL AFTER product_name,
  ADD COLUMN IF NOT EXISTS customer_id INT NULL,
  ADD COLUMN IF NOT EXISTS client_name VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS client_company_name VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS client_number VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS client_email VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS client_gstin VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS customer_address TEXT NULL,
  ADD COLUMN IF NOT EXISTS payment_entries TEXT NULL;
