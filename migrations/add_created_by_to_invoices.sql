-- Add created_by column to invoices table
-- This column will store the username of the user who created the invoice

ALTER TABLE invoices
ADD COLUMN `created_by` VARCHAR(255) NULL DEFAULT NULL AFTER `employee_name`;

-- Create index on the created_by column for better query performance
CREATE INDEX idx_invoice_created_by ON invoices(`created_by`);
