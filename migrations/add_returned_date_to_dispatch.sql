-- Add returned_date column to dispatch table
ALTER TABLE dispatch ADD COLUMN returned_date DATETIME NULL DEFAULT NULL;

-- Add index for better query performance
ALTER TABLE dispatch ADD INDEX idx_returned_date (returned_date);
