-- Add image_path to task_followup for follow-up image uploads
-- Run manually: mysql -u user -p database < migration_add_followup_image.sql
-- If column already exists, MySQL will error - safe to ignore.

ALTER TABLE task_followup ADD COLUMN image_path VARCHAR(500) NULL;
