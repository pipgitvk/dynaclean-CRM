-- Run once. Stores the new slot when status is "Rescheduled".

ALTER TABLE hr_hiring_entries
ADD COLUMN rescheduled_at DATETIME NULL COMMENT 'New interview slot when status is Rescheduled'
  AFTER interview_at;
