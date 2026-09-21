-- Run once: allow multiple targets per (designation, month, year, hr_username) when city differs.
-- 1) Normalize NULL city so uniqueness is well-defined
UPDATE hr_designation_monthly_targets SET city = '' WHERE city IS NULL;

-- 2) Drop old unique (designation, month, year, hr_username)
ALTER TABLE hr_designation_monthly_targets
  DROP INDEX uq_hr_desig_month_year_user;

-- 3) New unique: same role + same month can repeat with different city
ALTER TABLE hr_designation_monthly_targets
  ADD UNIQUE KEY uq_hr_desig_month_year_user_city (designation, month, year, hr_username, city);
