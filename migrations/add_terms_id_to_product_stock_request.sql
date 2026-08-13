-- Add terms_id column to product_stock_request table
ALTER TABLE product_stock_request
  ADD COLUMN IF NOT EXISTS terms_id INT NULL AFTER payment_entries;
