-- Fix the asset_category ENUM to accept any value from asset_categories table
-- The current ENUM is too restrictive and rejects values outside its list

-- Step 1: Change asset_category from ENUM to VARCHAR to allow dynamic categories
ALTER TABLE assets MODIFY COLUMN asset_category VARCHAR(100) NULL DEFAULT NULL;

-- Step 2: Verify the change
-- SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'assets' AND COLUMN_NAME = 'asset_category';
