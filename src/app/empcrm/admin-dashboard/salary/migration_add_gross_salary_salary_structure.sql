-- Optional manual gross (overrides component sum for summaries when set).
-- Run once; skip if column already exists.

ALTER TABLE employee_salary_structure
  ADD COLUMN gross_salary DECIMAL(12, 2) NULL COMMENT 'Manual gross (monthly); NULL = use sum of earning components';
