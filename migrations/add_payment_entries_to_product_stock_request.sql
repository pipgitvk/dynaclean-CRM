ALTER TABLE product_stock_request
ADD COLUMN IF NOT EXISTS payment_entries TEXT NULL AFTER customer_address;
