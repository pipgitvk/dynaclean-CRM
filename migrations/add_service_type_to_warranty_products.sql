-- Add service_type column to warranty_products table
-- This will store either 'CAM' or 'AMC'
ALTER TABLE warranty_products
ADD COLUMN service_type VARCHAR(10) NULL DEFAULT NULL
AFTER warranty_period;

-- If you need to set a default for existing records (optional)
-- UPDATE warranty_products SET service_type = 'CAM' WHERE service_type IS NULL;
