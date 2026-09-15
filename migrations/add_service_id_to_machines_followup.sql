-- Add service_id to machines_followup (service_records.service_id)
-- Map by serial_number: latest service record per serial.

SET SESSION sql_mode = 'ALLOW_INVALID_DATES';

ALTER TABLE machines_followup
  ADD COLUMN service_id INT NULL AFTER machine_id;

ALTER TABLE machines_followup
  ADD INDEX idx_service_id (service_id);

UPDATE machines_followup mf
INNER JOIN (
  SELECT
    TRIM(serial_number) COLLATE utf8mb4_unicode_ci AS serial_key,
    MAX(service_id) AS service_id
  FROM service_records
  WHERE serial_number IS NOT NULL AND TRIM(serial_number) != ''
  GROUP BY TRIM(serial_number) COLLATE utf8mb4_unicode_ci
) sr ON TRIM(mf.serial_number) COLLATE utf8mb4_unicode_ci = sr.serial_key
SET mf.service_id = sr.service_id
WHERE mf.service_id IS NULL;
