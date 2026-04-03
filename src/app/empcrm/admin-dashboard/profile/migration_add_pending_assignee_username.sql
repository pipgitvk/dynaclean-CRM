-- Optional: run npm run migrate:profile-submission-pending-assignee (idempotent)
ALTER TABLE employee_profile_submissions
  ADD COLUMN pending_assignee_username VARCHAR(255) NULL
  COMMENT 'When set, only this HR user (or HR Head/Super Admin) can act on pending';
