-- Prefer phpMyAdmin: run ONE file at a time from migrations/manual/
--   neworder_quotation_id_01_add_column.sql
--   neworder_quotation_id_02_backfill.sql

-- Step 1 only (run alone):
ALTER TABLE `neworder`
  ADD COLUMN `quotation_id` INT NULL DEFAULT NULL
  COMMENT 'quotations_records.S.No.'
  AFTER `quote_number`;
