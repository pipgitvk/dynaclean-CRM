-- Add reason column to meta_leads table
ALTER TABLE meta_leads ADD COLUMN import_reason TEXT NULL COMMENT 'Reason why lead was not imported to CRM';
