-- Add from_state (other from_* columns added in add_from_company_columns_order_invoice_quotation.sql)

ALTER TABLE `invoices`
  ADD COLUMN `from_state` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Billing entity state label';

ALTER TABLE `quotations_records`
  ADD COLUMN `from_state` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Billing entity state label';
