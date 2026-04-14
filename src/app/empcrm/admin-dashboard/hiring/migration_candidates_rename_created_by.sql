-- Run once: rename candidates.created_by_username -> created_by (phpMyAdmin / CLI).
-- Preserves data and existing indexes on the column.

ALTER TABLE candidates
  CHANGE COLUMN created_by_username `created_by` VARCHAR(128) NOT NULL;
