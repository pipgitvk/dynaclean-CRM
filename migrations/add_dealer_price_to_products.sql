-- Migration: Add dealer_price column to products_list table
-- Purpose: Add support for dealer pricing alongside GEM Price and other pricing options
-- Date: 2026-07-17

-- Add dealer_price column if it doesn't exist
ALTER TABLE products_list 
ADD COLUMN dealer_price DECIMAL(10, 2) DEFAULT 0 AFTER gem_price;

-- Optional: Verify the column was added
-- SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'products_list' AND COLUMN_NAME = 'dealer_price';
