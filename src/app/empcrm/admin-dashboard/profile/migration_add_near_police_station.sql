-- Run once on MySQL: adds mandatory-address-related field for employee profile.
-- ALTER is safe if the column already exists only when you skip duplicate runs.
ALTER TABLE employee_profiles
  ADD COLUMN near_police_station VARCHAR(500) NULL
  COMMENT 'Nearest police station name (mandatory on profile form)';
