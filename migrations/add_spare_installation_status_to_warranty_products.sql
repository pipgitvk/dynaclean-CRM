ALTER TABLE warranty_products
ADD COLUMN spare_installation_status VARCHAR(32) NULL DEFAULT NULL
  COMMENT 'completed | pending (spare registrations only)'
  AFTER installation_completed_date;