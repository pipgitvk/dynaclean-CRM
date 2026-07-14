-- Add gem_next_followup column to customers_followup table
ALTER TABLE customers_followup ADD COLUMN gem_next_followup DATETIME NULL AFTER service_next_followup;

-- Add comment to describe the column
ALTER TABLE customers_followup MODIFY gem_next_followup DATETIME NULL COMMENT 'Next follow-up date set by GEM users';
