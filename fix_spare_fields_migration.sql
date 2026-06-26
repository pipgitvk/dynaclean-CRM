-- Production Fix: Add missing columns and rename price to purchase_price
-- This script safely handles the migration with proper checks

-- Step 1: Add new columns if they don't exist
ALTER TABLE spare_list
ADD COLUMN IF NOT EXISTS `type` VARCHAR(50) DEFAULT NULL COMMENT 'Type of spare (Raw Materials, Consumables, Spares)',
ADD COLUMN IF NOT EXISTS `make` VARCHAR(255) DEFAULT NULL COMMENT 'Manufacturer/Make of the spare',
ADD COLUMN IF NOT EXISTS `model` VARCHAR(255) DEFAULT NULL COMMENT 'Model number of the spare',
ADD COLUMN IF NOT EXISTS `compatible_machine` TEXT DEFAULT NULL COMMENT 'Comma-separated list of product numbers (codes)',
ADD COLUMN IF NOT EXISTS `tax` DECIMAL(5, 2) DEFAULT 0 COMMENT 'Tax percentage',
ADD COLUMN IF NOT EXISTS `last_negotiation_price` DECIMAL(10, 2) DEFAULT NULL COMMENT 'Last negotiated price for the spare',
ADD COLUMN IF NOT EXISTS `sale_price` DECIMAL(10, 2) DEFAULT NULL COMMENT 'Sale price for the spare',
ADD COLUMN IF NOT EXISTS `purchase_price` DECIMAL(10, 2) COMMENT 'Purchase price of the spare';

-- Step 2: If purchase_price is empty but price exists, copy price to purchase_price
UPDATE spare_list 
SET purchase_price = price 
WHERE purchase_price IS NULL AND price IS NOT NULL;

-- Step 3: Add indexes for better search performance
ALTER TABLE spare_list
ADD INDEX IF NOT EXISTS idx_type (type),
ADD INDEX IF NOT EXISTS idx_make (make),
ADD INDEX IF NOT EXISTS idx_model (model);
