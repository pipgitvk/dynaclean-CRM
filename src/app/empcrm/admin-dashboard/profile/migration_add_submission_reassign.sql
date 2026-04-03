-- Run once on MySQL: stores which profile fields HR sent back for correction
-- Prefer: npm run migrate:profile-submission-reassign (idempotent; uses .env)
ALTER TABLE employee_profile_submissions
  ADD COLUMN reassigned_fields TEXT NULL COMMENT 'JSON array of field keys',
  ADD COLUMN reassignment_note TEXT NULL;
