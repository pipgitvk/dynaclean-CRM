-- Run once after migration_hr_hiring_entries.sql
-- Adds applicant pipeline fields; hire_date becomes optional until candidate is hired.

ALTER TABLE hr_hiring_entries
  ADD COLUMN emp_contact VARCHAR(64) NULL DEFAULT NULL AFTER candidate_name,
  ADD COLUMN marital_status VARCHAR(32) NULL DEFAULT NULL AFTER emp_contact,
  ADD COLUMN experience_type VARCHAR(32) NULL DEFAULT NULL COMMENT 'fresher | experience' AFTER marital_status,
  ADD COLUMN interview_at DATETIME NULL DEFAULT NULL AFTER experience_type,
  ADD COLUMN interview_mode VARCHAR(64) NULL DEFAULT NULL AFTER interview_at,
  ADD COLUMN status VARCHAR(80) NOT NULL DEFAULT 'Shortlisted for interview' AFTER interview_mode,
  ADD COLUMN tag VARCHAR(64) NULL DEFAULT NULL AFTER status;

ALTER TABLE hr_hiring_entries
  MODIFY COLUMN hire_date DATE NULL DEFAULT NULL;
