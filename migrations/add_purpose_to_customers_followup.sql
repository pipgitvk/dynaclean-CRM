-- Add `purpose` column to customers_followup table
-- Used by SERVICE SUPPORT to record calling purpose (Service / CAMC / Installation)
ALTER TABLE customers_followup
  ADD COLUMN IF NOT EXISTS purpose VARCHAR(100) NULL DEFAULT NULL;
