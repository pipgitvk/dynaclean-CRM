-- Add returned_date and returned_status columns to invoices table
ALTER TABLE invoices 
ADD COLUMN returned_date DATETIME NULL DEFAULT NULL,
ADD COLUMN returned_status ENUM('partial', 'full') NULL DEFAULT NULL;

-- Add index for better query performance
ALTER TABLE invoices ADD INDEX idx_returned_status (returned_status);
ALTER TABLE invoices ADD INDEX idx_returned_date (returned_date);
