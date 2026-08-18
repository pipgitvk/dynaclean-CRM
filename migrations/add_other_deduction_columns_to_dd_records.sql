-- Add Other Deduction columns to dd_records table
-- This migration adds support for tracking deductions from DD amounts

ALTER TABLE dd_records ADD COLUMN other_deduction_amount DECIMAL(10, 2) NULL DEFAULT 0 AFTER dd_receipt;

ALTER TABLE dd_records ADD COLUMN other_deduction_remark TEXT NULL AFTER other_deduction_amount;

-- Create index for better query performance on deduction searches
CREATE INDEX idx_dd_records_deduction ON dd_records(other_deduction_amount);

-- Add comment for documentation
ALTER TABLE dd_records MODIFY COLUMN other_deduction_amount DECIMAL(10, 2) NULL DEFAULT 0 COMMENT 'Amount to be deducted from main DD amount';
ALTER TABLE dd_records MODIFY COLUMN other_deduction_remark TEXT NULL COMMENT 'Reason/remark for the deduction';
