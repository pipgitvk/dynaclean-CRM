-- Optional: candidate's expected salary (not required on save)
ALTER TABLE candidates
  ADD COLUMN expected_salary VARCHAR(255) NULL DEFAULT NULL AFTER current_salary;
