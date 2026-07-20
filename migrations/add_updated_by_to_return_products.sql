-- Add updated_by column to return_products table
ALTER TABLE return_products 
ADD COLUMN IF NOT EXISTS updated_by INT NULL AFTER created_by,
ADD INDEX IF NOT EXISTS idx_updated_by (updated_by);