-- Add missing columns to spare_list table
-- This migration adds Type, Make, Model, Compatible Machines, Tax, Last Negotiation Price, and Sale Price fields

ALTER TABLE spare_list
ADD COLUMN IF NOT EXISTS `type` VARCHAR(50) DEFAULT NULL COMMENT 'Type of spare (Raw Materials, Consumables, Spares)',
ADD COLUMN IF NOT EXISTS `make` VARCHAR(255) DEFAULT NULL COMMENT 'Manufacturer/Make of the spare',
ADD COLUMN IF NOT EXISTS `model` VARCHAR(255) DEFAULT NULL COMMENT 'Model number of the spare',
ADD COLUMN IF NOT EXISTS `compatible_machine` TEXT DEFAULT NULL COMMENT 'Comma-separated list of product numbers (codes)',
ADD COLUMN IF NOT EXISTS `tax` DECIMAL(5, 2) DEFAULT 0 COMMENT 'Tax percentage',
ADD COLUMN IF NOT EXISTS `last_negotiation_price` DECIMAL(10, 2) DEFAULT NULL COMMENT 'Last negotiated price for the spare',
ADD COLUMN IF NOT EXISTS `sale_price` DECIMAL(10, 2) DEFAULT NULL COMMENT 'Sale price for the spare';

-- Rename price column to purchase_price if price column exists and purchase_price doesn't
SET @column_exists = 0;
SELECT COUNT(*) INTO @column_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'spare_list' AND COLUMN_NAME = 'price' AND TABLE_SCHEMA = DATABASE();

SET @purchase_price_exists = 0;
SELECT COUNT(*) INTO @purchase_price_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'spare_list' AND COLUMN_NAME = 'purchase_price' AND TABLE_SCHEMA = DATABASE();

-- Only rename if price exists and purchase_price doesn't
-- Note: In MySQL, you may need to run this manually if the IF conditions don't work:
-- ALTER TABLE spare_list CHANGE COLUMN price purchase_price DECIMAL(10, 2) NOT NULL COMMENT 'Purchase price of the spare';

-- Add indexes for better search performance
ALTER TABLE spare_list
ADD INDEX IF NOT EXISTS idx_type (type),
ADD INDEX IF NOT EXISTS idx_make (make),
ADD INDEX IF NOT EXISTS idx_model (model);
