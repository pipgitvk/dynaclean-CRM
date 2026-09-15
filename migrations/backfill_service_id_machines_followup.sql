-- Backfill service_id on existing machines_followup rows from service_records.
-- Use the same collation on both sides (tables often differ: unicode_ci vs general_ci).

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
