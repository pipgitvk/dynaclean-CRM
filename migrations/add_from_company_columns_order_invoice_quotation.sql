-- Seller / letterhead snapshot on invoice and quotation headers (not stored on neworder)

ALTER TABLE `invoices`
  ADD COLUMN `from_company` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Billing entity company name',
  ADD COLUMN `from_gst` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Billing entity GSTIN',
  ADD COLUMN `from_address` TEXT NULL COMMENT 'Billing entity address',
  ADD COLUMN `from_mobile` VARCHAR(50) NULL DEFAULT NULL,
  ADD COLUMN `from_email` VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN `from_state` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Billing entity state label',
  ADD COLUMN `logo_file` VARCHAR(500) NULL DEFAULT NULL COMMENT 'Logo URL or upload path',
  ADD COLUMN `CIN_new` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Company CIN';

ALTER TABLE `quotations_records`
  ADD COLUMN `from_company` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Billing entity company name',
  ADD COLUMN `from_gst` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Billing entity GSTIN',
  ADD COLUMN `from_address` TEXT NULL COMMENT 'Billing entity address',
  ADD COLUMN `from_mobile` VARCHAR(50) NULL DEFAULT NULL,
  ADD COLUMN `from_email` VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN `from_state` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Billing entity state label',
  ADD COLUMN `logo_file` VARCHAR(500) NULL DEFAULT NULL COMMENT 'Logo URL or upload path',
  ADD COLUMN `CIN_new` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Company CIN';
