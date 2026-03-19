-- Add model column to TL_followups for product/model info
-- Run manually if needed: mysql -u user -p database < migration_add_tl_followup_model.sql
-- If column already exists, MySQL will error - safe to ignore.

ALTER TABLE TL_followups ADD COLUMN model VARCHAR(255) NULL AFTER multi_tag;
