-- Add service_next_followup column to customers_followup table
ALTER TABLE customers_followup ADD COLUMN service_next_followup DATETIME NULL AFTER next_followup_date;

-- Add comment to describe the column
ALTER TABLE customers_followup MODIFY service_next_followup DATETIME NULL COMMENT 'Next follow-up date set by Service Support users';
