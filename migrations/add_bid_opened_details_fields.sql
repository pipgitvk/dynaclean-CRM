-- Migration: Add Bid Opened Details Fields to bids table
-- Description: Adds L1, L2, and L3 level company names and prices for bid opened details
-- Date: July 2026

ALTER TABLE bids ADD COLUMN IF NOT EXISTS l1_level VARCHAR(255) NULL COMMENT 'L1 Bidder Company Name';
ALTER TABLE bids ADD COLUMN IF NOT EXISTS l1_price DECIMAL(10,2) NULL COMMENT 'L1 Bid Price';
ALTER TABLE bids ADD COLUMN IF NOT EXISTS l2_level VARCHAR(255) NULL COMMENT 'L2 Bidder Company Name';
ALTER TABLE bids ADD COLUMN IF NOT EXISTS l2_price DECIMAL(10,2) NULL COMMENT 'L2 Bid Price';
ALTER TABLE bids ADD COLUMN IF NOT EXISTS l3_level VARCHAR(255) NULL COMMENT 'L3 Bidder Company Name';
ALTER TABLE bids ADD COLUMN IF NOT EXISTS l3_price DECIMAL(10,2) NULL COMMENT 'L3 Bid Price';

-- Add indexes for performance
ALTER TABLE bids ADD INDEX IF NOT EXISTS idx_bid_opened_details (l1_level, l2_level, l3_level);

-- Verify the columns were added
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bids'
AND COLUMN_NAME IN ('l1_level', 'l1_price', 'l2_level', 'l2_price', 'l3_level', 'l3_price');
