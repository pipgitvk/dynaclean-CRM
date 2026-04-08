-- Run once after migration_hr_hiring_package.sql
-- Months of probation when tag = Probation.

ALTER TABLE hr_hiring_entries
  ADD COLUMN probation_months TINYINT UNSIGNED NULL DEFAULT NULL AFTER `package`;
