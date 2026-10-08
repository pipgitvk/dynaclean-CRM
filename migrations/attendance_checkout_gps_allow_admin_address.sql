-- Allow HR admin edits: checkout without GPS when checkout_address = 'Admin'.
-- Allow system auto-checkout when checkout_address = 'Automatic'.
-- Still blocks fake checkouts with NULL coords and other addresses.
-- Run once: mysql -u ... -p your_db < migrations/attendance_checkout_gps_allow_admin_address.sql

DELIMITER $$

DROP TRIGGER IF EXISTS attendance_logs_bi_checkout_requires_gps $$
DROP TRIGGER IF EXISTS attendance_logs_bu_checkout_requires_gps $$

CREATE TRIGGER attendance_logs_bi_checkout_requires_gps
BEFORE INSERT ON attendance_logs
FOR EACH ROW
BEGIN
  IF NEW.checkout_time IS NOT NULL
     AND (NEW.checkout_latitude IS NULL OR NEW.checkout_longitude IS NULL)
     AND TRIM(COALESCE(NEW.checkout_address, '')) NOT IN ('Admin', 'Automatic') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Checkout requires GPS (checkout_latitude and checkout_longitude).';
  END IF;
END $$

CREATE TRIGGER attendance_logs_bu_checkout_requires_gps
BEFORE UPDATE ON attendance_logs
FOR EACH ROW
BEGIN
  IF NEW.checkout_time IS NOT NULL
     AND (NEW.checkout_latitude IS NULL OR NEW.checkout_longitude IS NULL)
     AND TRIM(COALESCE(NEW.checkout_address, '')) NOT IN ('Admin', 'Automatic') THEN
    IF NOT (
      OLD.checkout_time <=> NEW.checkout_time
      AND OLD.checkout_latitude <=> NEW.checkout_latitude
      AND OLD.checkout_longitude <=> NEW.checkout_longitude
      AND TRIM(COALESCE(OLD.checkout_address, '')) <=> TRIM(COALESCE(NEW.checkout_address, ''))
    ) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Checkout requires GPS (checkout_latitude and checkout_longitude).';
    END IF;
  END IF;
END $$

DELIMITER ;
