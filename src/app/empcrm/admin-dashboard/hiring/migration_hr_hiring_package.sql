-- Run once after migration_hr_hiring_extended_fields.sql
-- Package (CTC / offer) for hired candidates.

ALTER TABLE hr_hiring_entries
  ADD COLUMN `package` VARCHAR(255) NULL DEFAULT NULL AFTER hire_date;
