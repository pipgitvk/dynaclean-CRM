-- Add contract_no column to dd_records table
ALTER TABLE dd_records ADD COLUMN contract_no VARCHAR(255) NULL AFTER remark;
