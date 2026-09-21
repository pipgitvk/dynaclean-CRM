-- Run once if you already created hr_designation_monthly_targets without hr_username.
-- Adds optional HR login username so Superadmin can assign a target even when profile designation is empty.

ALTER TABLE hr_designation_monthly_targets
  ADD COLUMN hr_username VARCHAR(128) NOT NULL DEFAULT '' AFTER designation;

ALTER TABLE hr_designation_monthly_targets
  DROP INDEX uq_hr_desig_month_year;

ALTER TABLE hr_designation_monthly_targets
  ADD UNIQUE KEY uq_hr_desig_month_year_user (designation, month, year, hr_username);
