-- Add remark column to dd_records table
ALTER TABLE dd_records ADD COLUMN remark TEXT NULL AFTER bid_document;
