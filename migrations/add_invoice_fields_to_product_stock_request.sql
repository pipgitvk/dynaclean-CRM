-- Add invoice_number and invoice_date columns to product_stock_request
ALTER TABLE product_stock_request
  ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(255) DEFAULT NULL AFTER remarks,
  ADD COLUMN IF NOT EXISTS invoice_date DATE DEFAULT NULL AFTER invoice_number;
