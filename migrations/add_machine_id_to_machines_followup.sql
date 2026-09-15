-- Add machine_id to machines_followup (warranty_products.id)
--
-- MySQL #1067: ALTER revalidates every TIMESTAMP column. next_followup_date was
-- TIMESTAMP NOT NULL with an implicit '0000-00-00 00:00:00' default, which
-- strict sql_mode rejects. Convert it to DATETIME in the same ALTER.

SET SESSION sql_mode = 'ALLOW_INVALID_DATES';

ALTER TABLE machines_followup
  MODIFY COLUMN next_followup_date DATETIME NOT NULL,
  ADD COLUMN machine_id INT UNSIGNED NULL AFTER id;

ALTER TABLE machines_followup
ADD INDEX idx_machine_id (machine_id);

-- Backfill from warranty_products by serial number (first matching id if duplicates)
UPDATE machines_followup mf
INNER JOIN (
  SELECT serial_number, MIN(id) AS id
  FROM warranty_products
  WHERE serial_number IS NOT NULL AND TRIM(serial_number) != ''
  GROUP BY serial_number
) wp ON TRIM(mf.serial_number) = TRIM(wp.serial_number)
SET mf.machine_id = wp.id
WHERE mf.machine_id IS NULL;
