-- Add bid_document column to dd_records table
ALTER TABLE dd_records ADD COLUMN bid_document VARCHAR(500) NULL AFTER mode_of_payment;
