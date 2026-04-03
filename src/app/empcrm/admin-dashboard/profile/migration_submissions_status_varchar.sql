-- Run once so status can store: pending, approved, rejected, reassign, revision_requested
-- Or: npm run migrate:profile-submission-status
ALTER TABLE employee_profile_submissions
  MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pending';
