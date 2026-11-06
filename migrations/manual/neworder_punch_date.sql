-- Order Process: punch_date = when order was punched in CRM; created_at = Order/PO date
ALTER TABLE `neworder`
  ADD COLUMN IF NOT EXISTS `punch_date` DATETIME NULL DEFAULT NULL COMMENT 'CRM punch/create timestamp';

UPDATE `neworder`
SET `punch_date` = `created_at`
WHERE `punch_date` IS NULL
  AND `created_at` IS NOT NULL;
