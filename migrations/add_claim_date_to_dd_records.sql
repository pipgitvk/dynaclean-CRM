-- Add claim_date column to dd_records table for tracking when DD/BG was claimed from bank
ALTER TABLE dd_records
  ADD COLUMN IF NOT EXISTS claim_date DATE NULL AFTER claim_from_bank;

-- Add index for faster claim date filtering
CREATE INDEX idx_dd_records_claim_date ON dd_records(claim_date);