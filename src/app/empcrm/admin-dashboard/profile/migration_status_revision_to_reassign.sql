-- Optional: normalize legacy status label (app already treats both the same)
UPDATE employee_profile_submissions SET status = 'reassign' WHERE status = 'revision_requested';
