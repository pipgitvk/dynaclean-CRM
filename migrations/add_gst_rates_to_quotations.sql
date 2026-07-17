-- Add individual GST rate columns to quotations_records table
ALTER TABLE quotations_records 
ADD COLUMN cgst_rate DECIMAL(5,2) DEFAULT 9,
ADD COLUMN sgst_rate DECIMAL(5,2) DEFAULT 9,
ADD COLUMN igst_rate DECIMAL(5,2) DEFAULT 0;

-- Add indexes for better query performance
ALTER TABLE quotations_records ADD INDEX idx_cgst_rate (cgst_rate);
ALTER TABLE quotations_records ADD INDEX idx_sgst_rate (sgst_rate);
ALTER TABLE quotations_records ADD INDEX idx_igst_rate (igst_rate);
