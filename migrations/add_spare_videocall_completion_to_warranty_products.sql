-- Spare installed via videocall: who completed and when
ALTER TABLE warranty_products
ADD COLUMN installation_completed_by VARCHAR(120) NULL DEFAULT NULL AFTER installed_by,
ADD COLUMN installation_completed_date DATE NULL DEFAULT NULL AFTER installation_completed_by;