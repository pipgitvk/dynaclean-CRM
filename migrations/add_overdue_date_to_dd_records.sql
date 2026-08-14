-- Add overdue_date column to dd_records table for DD/BG overdue tracking
ALTER TABLE dd_records
  ADD COLUMN IF NOT EXISTS overdue_date DATE NULL AFTER security_type;

-- Add index for faster overdue date filtering
CREATE INDEX idx_dd_records_overdue_date ON dd_records(overdue_date);
