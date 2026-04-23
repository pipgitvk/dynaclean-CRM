-- Run once: candidates.hiring_city — free-text city (EMPCRM hiring)
ALTER TABLE candidates
  ADD COLUMN hiring_city VARCHAR(120) NULL DEFAULT NULL AFTER current_location;
