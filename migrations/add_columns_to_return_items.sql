-- Add missing columns to return_items table
ALTER TABLE return_items 
ADD COLUMN IF NOT EXISTS quotation_no VARCHAR(255) NULL AFTER return_id,
ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
ADD COLUMN IF NOT EXISTS updated_by INT NULL AFTER updated_at,
ADD INDEX IF NOT EXISTS idx_quotation_no (quotation_no),
ADD INDEX IF NOT EXISTS idx_updated_by (updated_by);