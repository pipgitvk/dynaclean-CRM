-- Add page and rank columns to keywords_followups table if they don't exist
ALTER TABLE keywords_followups 
ADD COLUMN IF NOT EXISTS page VARCHAR(255) AFTER followup_date,
ADD COLUMN IF NOT EXISTS rank INT DEFAULT 0 AFTER page;
