-- Add rank column to keywords_followups table
ALTER TABLE keywords_followups ADD COLUMN IF NOT EXISTS rank INT DEFAULT 0 AFTER followup_date;
