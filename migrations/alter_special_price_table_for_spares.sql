-- Add item_type column to special_price table
-- spare_id will be stored in the existing product_id column
-- item_type differentiates between products and spares

ALTER TABLE special_price 
ADD COLUMN IF NOT EXISTS item_type ENUM('product', 'spare') DEFAULT 'product' AFTER customer_id;

-- Update existing records to have item_type = 'product'
UPDATE special_price SET item_type = 'product' WHERE item_type IS NULL;
