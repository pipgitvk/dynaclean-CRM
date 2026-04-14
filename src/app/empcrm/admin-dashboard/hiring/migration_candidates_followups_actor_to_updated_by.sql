-- Run once: candidates_followups — rename actor_username -> updated_by

ALTER TABLE candidates_followups
  CHANGE COLUMN actor_username `updated_by` VARCHAR(128) NOT NULL COMMENT 'User who logged this status event';
