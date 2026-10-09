-- =============================================================================
-- Order Process — fill quotation_id from quote_number
-- Run ONLY after step 1 (column must exist).
-- Verify first:  SHOW COLUMNS FROM neworder LIKE 'quotation_id';
-- =============================================================================

UPDATE `neworder`
INNER JOIN `quotations_records` AS `qr`
  ON `neworder`.`quote_number` = `qr`.`quote_number`
SET `neworder`.`quotation_id` = `qr`.`S.No.`
WHERE `neworder`.`quotation_id` IS NULL
  AND `neworder`.`quote_number` IS NOT NULL;
