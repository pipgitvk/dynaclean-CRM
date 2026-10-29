-- tracking_id: add type (delivery | return) + backfill from neworder
-- Run on MariaDB/MySQL. Run step 1 once; then 2–5.

-- 1) Column (skip if already added)
ALTER TABLE tracking_id
  ADD COLUMN type VARCHAR(16) NOT NULL DEFAULT 'delivery'
  COMMENT 'delivery = forward booking LR, return = return pickup LR';

-- Optional index
-- CREATE INDEX idx_tracking_order_type ON tracking_id (order_id, type);

-- 2) Classify existing return rows (rest stay delivery)
UPDATE tracking_id
SET type = 'return'
WHERE source = 'return_booking'
   OR batch_sequence_no = 9000;

-- 3) Missing DELIVERY rows from neworder.booking_id (batch 1)
INSERT INTO tracking_id (order_id, lr_number, booking_url, source, batch_sequence_no, type)
SELECT
  no.order_id,
  TRIM(no.booking_id),
  NULLIF(TRIM(no.booking_url), ''),
  'backfill_booking',
  1,
  'delivery'
FROM neworder no
WHERE TRIM(COALESCE(no.booking_id, '')) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM tracking_id t
    WHERE t.order_id = no.order_id
      AND t.type = 'delivery'
      AND t.batch_sequence_no = 1
  );

-- 4) Missing RETURN rows from neworder.return_booking_ref
INSERT INTO tracking_id (order_id, lr_number, booking_url, source, batch_sequence_no, type)
SELECT
  no.order_id,
  TRIM(no.return_booking_ref),
  NULLIF(TRIM(no.return_booking_url), ''),
  'backfill_return_booking',
  9000,
  'return'
FROM neworder no
WHERE TRIM(COALESCE(no.return_booking_ref, '')) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM tracking_id t
    WHERE t.order_id = no.order_id
      AND t.type = 'return'
  );

-- 5) Verify
-- SELECT type, COUNT(*) FROM tracking_id GROUP BY type;
-- SELECT * FROM tracking_id WHERE order_id = '20261009006';
