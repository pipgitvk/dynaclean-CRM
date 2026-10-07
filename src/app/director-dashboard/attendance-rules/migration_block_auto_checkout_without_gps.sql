-- Blocks checkout without GPS unless checkout_address = 'Admin' (HR manual edit).
-- Run once on the production DB (MySQL 5.7+ / 8.x).
-- See also: migrations/attendance_checkout_gps_allow_admin_address.sql

DELIMITER $$

DROP TRIGGER IF EXISTS attendance_logs_bi_checkout_requires_gps $$
DROP TRIGGER IF EXISTS attendance_logs_bu_checkout_requires_gps $$

CREATE TRIGGER attendance_logs_bi_checkout_requires_gps
BEFORE INSERT ON attendance_logs
FOR EACH ROW
BEGIN
  IF NEW.checkout_time IS NOT NULL
     AND (NEW.checkout_latitude IS NULL OR NEW.checkout_longitude IS NULL)
     AND TRIM(COALESCE(NEW.checkout_address, '')) <> 'Admin' THEN
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
     AND TRIM(COALESCE(NEW.checkout_address, '')) <> 'Admin' THEN
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
