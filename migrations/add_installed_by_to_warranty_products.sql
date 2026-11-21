-- Spare registration: how installation was done (videocall / customer self / on site)
ALTER TABLE warranty_products
ADD COLUMN installed_by VARCHAR(64) NULL DEFAULT NULL
AFTER contact_person;