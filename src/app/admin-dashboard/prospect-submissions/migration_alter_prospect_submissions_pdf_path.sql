-- Optional: if prospect_submissions already exists with shorter pdf_path,
-- run this so Cloudinary URLs fit safely.

ALTER TABLE prospect_submissions
  MODIFY COLUMN pdf_path VARCHAR(1000) NOT NULL;
