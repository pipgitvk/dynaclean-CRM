-- Remove letterhead snapshot columns from neworder (kept on invoices + quotations_records)

ALTER TABLE `neworder` DROP COLUMN IF EXISTS `from_company`;
ALTER TABLE `neworder` DROP COLUMN IF EXISTS `from_gst`;
ALTER TABLE `neworder` DROP COLUMN IF EXISTS `from_address`;
ALTER TABLE `neworder` DROP COLUMN IF EXISTS `from_mobile`;
ALTER TABLE `neworder` DROP COLUMN IF EXISTS `from_email`;
ALTER TABLE `neworder` DROP COLUMN IF EXISTS `from_state`;
ALTER TABLE `neworder` DROP COLUMN IF EXISTS `logo_file`;
ALTER TABLE `neworder` DROP COLUMN IF EXISTS `CIN_new`;
