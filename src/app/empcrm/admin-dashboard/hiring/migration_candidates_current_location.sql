ALTER TABLE candidates
  ADD COLUMN current_location VARCHAR(255) NULL DEFAULT NULL AFTER expected_salary;