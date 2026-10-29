let trackingIdTableReady = false;

/** Separate batch row for return pickup LR (outbound uses 1, 2, …). */
export const RETURN_TRACKING_BATCH_SEQ = 9000;

export const TRACKING_TYPE_DELIVERY = "delivery";
export const TRACKING_TYPE_RETURN = "return";

/** Align with neworder.order_id (varchar 255, utf8mb4_general_ci). */
const ORDER_ID_SQL =
  "VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL";

export async function ensureTrackingIdTable(conn) {
  if (trackingIdTableReady) return;
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS tracking_id (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id ${ORDER_ID_SQL},
      lr_number VARCHAR(64) NULL,
      booking_url TEXT NULL,
      source VARCHAR(64) NULL,
      batch_sequence_no INT NOT NULL DEFAULT 1,
      type VARCHAR(16) NOT NULL DEFAULT 'delivery',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_tracking_order (order_id),
      KEY idx_tracking_lr (lr_number),
      KEY idx_tracking_order_type (order_id, type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  try {
    await conn.execute(`
      ALTER TABLE tracking_id
        MODIFY order_id ${ORDER_ID_SQL}
    `);
  } catch {
    /* ignore */
  }
  try {
    await conn.execute(`
      ALTER TABLE tracking_id
        ADD COLUMN type VARCHAR(16) NOT NULL DEFAULT 'delivery'
        COMMENT 'delivery = forward booking, return = return pickup'
    `);
  } catch {
    /* exists */
  }
  try {
    await conn.execute(`
      CREATE INDEX idx_tracking_order_type ON tracking_id (order_id, type)
    `);
  } catch {
    /* exists */
  }
  trackingIdTableReady = true;
}

/**
 * neworder.booking_id → tracking_id.lr_number (type = delivery)
 * @param {import("mysql2/promise").PoolConnection} conn
 */
export async function persistOrderTrackingFromBooking(
  conn,
  orderId,
  {
    bookingId = null,
    bookingUrl = null,
    batchSequenceNo = 1,
    source = "upload_booking",
    trackingType = TRACKING_TYPE_DELIVERY,
  } = {},
) {
  await ensureTrackingIdTable(conn);

  const oid = String(orderId ?? "").trim();
  const lrNumber = String(bookingId ?? "").trim();
  if (!oid || !lrNumber) return;

  const url = bookingUrl != null ? String(bookingUrl).trim() : null;
  const seq = Math.max(1, Number(batchSequenceNo) || 1);
  const type =
    trackingType === TRACKING_TYPE_RETURN
      ? TRACKING_TYPE_RETURN
      : TRACKING_TYPE_DELIVERY;

  const [existing] = await conn.execute(
    `SELECT id FROM tracking_id
     WHERE order_id = ? AND type = ? AND batch_sequence_no = ?
     LIMIT 1`,
    [oid, type, seq],
  );

  if (existing?.length) {
    await conn.execute(
      `UPDATE tracking_id
       SET lr_number = ?, booking_url = ?, source = ?, type = ?
       WHERE id = ?`,
      [lrNumber, url, source, type, existing[0].id],
    );
    return;
  }

  await conn.execute(
    `INSERT INTO tracking_id
      (order_id, lr_number, booking_url, source, batch_sequence_no, type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [oid, lrNumber, url, source, seq, type],
  );
}

/**
 * neworder.return_booking_ref → tracking_id.lr_number (type = return)
 * @param {import("mysql2/promise").PoolConnection} conn
 */
export async function persistOrderTrackingFromReturnBooking(
  conn,
  orderId,
  {
    returnBookingRef = null,
    returnBookingUrl = null,
  } = {},
) {
  await persistOrderTrackingFromBooking(conn, orderId, {
    bookingId: returnBookingRef,
    bookingUrl: returnBookingUrl,
    batchSequenceNo: RETURN_TRACKING_BATCH_SEQ,
    source: "return_booking",
    trackingType: TRACKING_TYPE_RETURN,
  });
}
