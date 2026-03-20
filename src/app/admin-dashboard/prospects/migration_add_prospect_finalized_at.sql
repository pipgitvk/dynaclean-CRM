-- Run once if the app user cannot ALTER (ensureProspectsTable also adds this column).
ALTER TABLE prospects ADD COLUMN finalized_at TIMESTAMP NULL;
