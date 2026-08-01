-- Add type column to invoices table
-- This column will store the type of invoice: 'tax' or 'performa'

ALTER TABLE invoices 
ADD COLUMN `type` VARCHAR(20) DEFAULT 'tax' AFTER `quotation_id`;

-- Create index on the type column for better query performance
CREATE INDEX idx_invoice_type ON invoices(`type`);
