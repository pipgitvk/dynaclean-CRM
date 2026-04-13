-- Run once: store the note submitted with each hiring history event (create, status change, or note-only edit).
ALTER TABLE hr_hiring_entry_status_history
  ADD COLUMN note TEXT NULL COMMENT 'Note saved with this event' AFTER actor_username;
