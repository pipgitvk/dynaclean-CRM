-- Add customer_id field to neworder table
ALTER TABLE neworder ADD COLUMN IF NOT EXISTS customer_id INT DEFAULT NULL COMMENT 'Customer ID from quotation';
