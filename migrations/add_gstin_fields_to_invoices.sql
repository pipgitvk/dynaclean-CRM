-- Add Consignee GSTIN field to invoices table
-- gst_consignee: GSTIN of the consignee (ship to), if different from buyer

ALTER TABLE `invoices` ADD COLUMN `gst_consignee` VARCHAR(50) DEFAULT NULL COMMENT 'GSTIN of the consignee (ship to)';
