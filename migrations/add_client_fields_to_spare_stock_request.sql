-- Add customer/client fields to spare_stock_request table
-- Mirrors the same fields present in product_stock_request

ALTER TABLE spare_stock_request
  ADD COLUMN IF NOT EXISTS customer_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS client_name VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS client_company_name VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS client_number VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS client_email VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS client_gstin VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS customer_address TEXT DEFAULT NULL;
