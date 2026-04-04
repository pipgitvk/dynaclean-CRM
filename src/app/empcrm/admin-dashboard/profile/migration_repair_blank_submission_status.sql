-- Blank `status` after "Approve employee sections" usually means the column could not store `pending_hr_docs`
-- (e.g. ENUM without that value). Run the VARCHAR migration first, then repair stuck rows.

-- Step 1 (required once):
-- ALTER TABLE employee_profile_submissions MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pending';

-- Step 2 — set HR-docs step for rows stuck with empty status after first HR approve:
-- UPDATE employee_profile_submissions
-- SET status = 'pending_hr_docs'
-- WHERE (status IS NULL OR TRIM(status) = '')
--   AND reviewed_at IS NOT NULL
--   AND (rejection_reason IS NULL OR TRIM(rejection_reason) = '');
