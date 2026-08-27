/**
 * Pre-booking remark fields (cancelled/postponed) and extended status enum.
 * Returns whether columns are available (attempts ADD/MODIFY if missing).
 */
export async function ensurePreBookingRemarkColumns(conn) {
  const columns = [
    {
      name: "remark_type",
      sql: `ALTER TABLE pre_booking ADD COLUMN remark_type ENUM('cancelled', 'postponed') DEFAULT NULL COMMENT 'Order cancelled or postponed'`,
    },
    {
      name: "remark_reason",
      sql: `ALTER TABLE pre_booking ADD COLUMN remark_reason TEXT DEFAULT NULL COMMENT 'Reason note for cancellation or postponement'`,
    },
    {
      name: "postponed_date",
      sql: `ALTER TABLE pre_booking ADD COLUMN postponed_date DATE DEFAULT NULL COMMENT 'New expected date when order is postponed'`,
    },
  ];

  for (const col of columns) {
    const [existing] = await conn.execute(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'pre_booking'
         AND COLUMN_NAME = ?
       LIMIT 1`,
      [col.name],
    );
    if (existing.length > 0) continue;

    try {
      await conn.execute(col.sql);
    } catch (e) {
      if (e?.errno === 1060) continue;
      console.error(
        `pre_booking.${col.name} missing and could not be added:`,
        e?.code,
        e?.message,
      );
      return false;
    }
  }

  try {
    await conn.execute(
      `ALTER TABLE pre_booking MODIFY COLUMN status ENUM('pending', 'partial', 'received', 'cancelled', 'postponed') DEFAULT 'pending'`,
    );
  } catch (e) {
    // Enum may already include these values
    if (!String(e?.message || "").includes("Duplicate")) {
      console.error("pre_booking status enum update failed:", e?.code, e?.message);
    }
  }

  return true;
}
