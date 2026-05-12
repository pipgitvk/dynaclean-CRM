-- Add NEFT/IMPS/RTGS payment details columns to dd_records table
ALTER TABLE dd_records
ADD COLUMN reference_no VARCHAR(255) NULL,
ADD COLUMN payment_amount DECIMAL(15,2) NULL,
ADD COLUMN payment_proof VARCHAR(255) NULL,
ADD COLUMN receipt VARCHAR(255) NULL,
ADD COLUMN from_bank_account_no VARCHAR(255) NULL;
