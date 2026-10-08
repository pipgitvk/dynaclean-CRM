/** Must match ADMIN_EDIT_ATTENDANCE_ADDRESS in attendanceEditHistory.js */
const ADMIN_ADDR = "Admin";
/** Must match AUTO_CHECKOUT_ATTENDANCE_ADDRESS in attendanceAutoCheckoutConstants.js */
const AUTO_ADDR = "Automatic";

const TRIGGER_VERSION = 2;
const GLOBAL_VERSION_KEY = "__attendanceCheckoutGpsTriggerVersion__";

function checkoutWithoutGpsAllowedSql(conn) {
  const adminLit = conn.escape(ADMIN_ADDR);
  const autoLit = conn.escape(AUTO_ADDR);
  return `(TRIM(COALESCE(NEW.checkout_address, '')) <> ${adminLit} AND TRIM(COALESCE(NEW.checkout_address, '')) <> ${autoLit})`;
}

/**
 * Updates DB triggers so checkout without GPS is allowed when checkout_address is Admin (HR edits) or Automatic.
 */
export async function ensureAttendanceCheckoutGpsTriggersAllowAdmin(conn) {
  if (global[GLOBAL_VERSION_KEY] === TRIGGER_VERSION) return;
  const notAllowed = checkoutWithoutGpsAllowedSql(conn);

  await conn.query("DROP TRIGGER IF EXISTS attendance_logs_bi_checkout_requires_gps");
  await conn.query("DROP TRIGGER IF EXISTS attendance_logs_bu_checkout_requires_gps");

  await conn.query(`
CREATE TRIGGER attendance_logs_bi_checkout_requires_gps
BEFORE INSERT ON attendance_logs
FOR EACH ROW
BEGIN
  IF NEW.checkout_time IS NOT NULL
     AND (NEW.checkout_latitude IS NULL OR NEW.checkout_longitude IS NULL)
     AND ${notAllowed} THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Checkout requires GPS (checkout_latitude and checkout_longitude).';
  END IF;
END`);

  await conn.query(`
CREATE TRIGGER attendance_logs_bu_checkout_requires_gps
BEFORE UPDATE ON attendance_logs
FOR EACH ROW
BEGIN
  IF NEW.checkout_time IS NOT NULL
     AND (NEW.checkout_latitude IS NULL OR NEW.checkout_longitude IS NULL)
     AND ${notAllowed} THEN
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
END`);

  global[GLOBAL_VERSION_KEY] = TRIGGER_VERSION;
}
