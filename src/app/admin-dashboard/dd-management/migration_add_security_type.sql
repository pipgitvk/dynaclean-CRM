-- Add security_type column to dd_records table
ALTER TABLE dd_records ADD COLUMN security_type VARCHAR(50) NULL AFTER contract_no;
