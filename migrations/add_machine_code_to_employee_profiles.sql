-- eTimeOffice / punch machine employee code (separate from CRM empId)
ALTER TABLE employee_profiles
  ADD COLUMN machine_code VARCHAR(32) NULL
  AFTER employee_code;
