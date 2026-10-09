ALTER TABLE attendance_logs
  ADD COLUMN employee_id INT NULL AFTER username,
  ADD COLUMN machine_code VARCHAR(32) NULL AFTER employee_id;

UPDATE attendance_logs a
INNER JOIN rep_list r ON r.username = a.username
SET a.employee_id = r.empId,
    a.machine_code = NULLIF(TRIM(r.machine_code), '')
WHERE a.employee_id IS NULL
   OR a.machine_code IS NULL
   OR TRIM(a.machine_code) = '';
