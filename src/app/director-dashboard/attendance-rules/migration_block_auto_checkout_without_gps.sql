-- Blocks any checkout (checkout_time set) unless checkout_latitude and checkout_longitude are set.
-- This stops MySQL EVENTs / external cron jobs that write e.g. checkout_address = 'Auto checkout at 6:30 PM'
-- with NULL coordinates. Legitimate app checkout already sends GPS via /api/attendance and /api/empcrm/attendance.
--
-- Run once on the production DB (MySQL 5.7+ / 8.x), e.g. mysql CLI or phpMyAdmin (enable delimiter if needed).
--
-- --- Find and remove the scheduler that caused auto rows (run manually): ---
-- SHOW EVENTS;
-- SELECT * FROM information_schema.EVENTS WHERE EVENT_SCHEMA = DATABASE();
-- DROP EVENT IF EXISTS <event_name>;
--
-- --- If Hostinger / VPS cron runs a .sql file, remove that cron entry from the panel. ---

DELIMITER $$

DROP TRIGGER IF EXISTS attendance_logs_bi_checkout_requires_gps $$
DROP TRIGGER IF EXISTS attendance_logs_bu_checkout_requires_gps $$

CREATE TRIGGER attendance_logs_bi_checkout_requires_gps
BEFORE INSERT ON attendance_logs
FOR EACH ROW
BEGIN
  IF NEW.checkout_time IS NOT NULL
     AND (NEW.checkout_latitude IS NULL OR NEW.checkout_longitude IS NULL) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Checkout requires GPS (checkout_latitude and checkout_longitude).';
  END IF;
END $$

CREATE TRIGGER attendance_logs_bu_checkout_requires_gps
BEFORE UPDATE ON attendance_logs
FOR EACH ROW
BEGIN
  IF NEW.checkout_time IS NOT NULL
     AND (NEW.checkout_latitude IS NULL OR NEW.checkout_longitude IS NULL) THEN
    IF NOT (
      OLD.checkout_time <=> NEW.checkout_time
      AND OLD.checkout_latitude <=> NEW.checkout_latitude
      AND OLD.checkout_longitude <=> NEW.checkout_longitude
    ) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Checkout requires GPS (checkout_latitude and checkout_longitude).';
    END IF;
  END IF;
END $$

DELIMITER ;
