-- Machine Employee ID (eTimeOffice emp code) on rep_list, not employee_profiles
ALTER TABLE rep_list
  ADD COLUMN machine_code VARCHAR(32) NULL
  AFTER empId;

UPDATE rep_list r
INNER JOIN employee_profiles p ON p.username = r.username
SET r.machine_code = TRIM(p.machine_code)
WHERE TRIM(COALESCE(p.machine_code, '')) <> '';

ALTER TABLE employee_profiles DROP COLUMN machine_code;
