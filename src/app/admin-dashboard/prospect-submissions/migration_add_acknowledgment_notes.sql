-- Manual migration: acknowledgment notes for prospect submissions
-- Run on CRM MySQL DB if table already exists without these columns.

ALTER TABLE prospect_submissions
  ADD COLUMN IF NOT EXISTS acknowledgment_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS acknowledged_by VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS acknowledged_at DATETIME NULL;

-- MySQL versions without ADD COLUMN IF NOT EXISTS: run one-by-one and ignore "Duplicate column" errors:
-- ALTER TABLE prospect_submissions ADD COLUMN acknowledgment_notes TEXT NULL;
-- ALTER TABLE prospect_submissions ADD COLUMN acknowledged_by VARCHAR(255) NULL;
-- ALTER TABLE prospect_submissions ADD COLUMN acknowledged_at DATETIME NULL;

-- Optional: rename old reviewed rows to acknowledged
-- UPDATE prospect_submissions SET status = 'acknowledged' WHERE LOWER(TRIM(status)) = 'reviewed';
