-- Add status field to pre_booking table
ALTER TABLE pre_booking ADD COLUMN IF NOT EXISTS status ENUM('pending', 'received') DEFAULT 'pending' COMMENT 'Pre-booking status';
