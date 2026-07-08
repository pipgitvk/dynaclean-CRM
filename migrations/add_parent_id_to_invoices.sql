-- Add parent_id column to invoices table for parent-child relationship
-- Run this migration to enable parent-child invoice linking

ALTER TABLE invoices 
ADD COLUMN parent_id INT UNSIGNED NULL 
AFTER id;

-- Create index for better query performance
ALTER TABLE invoices 
ADD INDEX idx_parent_id (parent_id);
