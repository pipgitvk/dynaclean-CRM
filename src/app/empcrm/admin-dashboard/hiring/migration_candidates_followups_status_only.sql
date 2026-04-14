-- Run once on existing DB: candidates_followups — drop status_before, rename status_after -> `status`
-- New rows: one column `status` per event (create or status change).

ALTER TABLE candidates_followups
  DROP COLUMN status_before,
  CHANGE COLUMN status_after `status` VARCHAR(80) NOT NULL COMMENT 'Status at this event';
