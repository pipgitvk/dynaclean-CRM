-- Run once. Next slot when status is "next-follow-up".

ALTER TABLE hr_hiring_entries
ADD COLUMN next_followup_at DATETIME NULL COMMENT 'Next follow-up slot when status is next-follow-up'
  AFTER rescheduled_at;
