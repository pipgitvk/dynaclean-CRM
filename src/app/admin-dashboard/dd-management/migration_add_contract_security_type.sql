-- Add contract_no and security_type columns to dd_records table
ALTER TABLE dd_records ADD COLUMN contract_no VARCHAR(255) NULL;
ALTER TABLE dd_records ADD COLUMN security_type VARCHAR(50) NULL;
