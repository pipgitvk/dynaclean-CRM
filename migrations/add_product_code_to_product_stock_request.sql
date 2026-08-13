-- Add product_code column to product_stock_request table
ALTER TABLE product_stock_request
ADD COLUMN IF NOT EXISTS product_code VARCHAR(100) NULL AFTER product_name;
