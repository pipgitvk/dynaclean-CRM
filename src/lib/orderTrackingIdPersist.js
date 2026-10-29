let trackingIdTableReady = false;

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
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_tracking_order (order_id),
      KEY idx_tracking_lr (lr_number)
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
  trackingIdTableReady = true;
}

/**
 * neworder.booking_id → tracking_id.lr_number
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
  } = {},
) {
  await ensureTrackingIdTable(conn);

  const oid = String(orderId ?? "").trim();
  const lrNumber = String(bookingId ?? "").trim();
  if (!oid || !lrNumber) return;

  const url = bookingUrl != null ? String(bookingUrl).trim() : null;
  const seq = Math.max(1, Number(batchSequenceNo) || 1);

  const [existing] = await conn.execute(
    `SELECT id FROM tracking_id WHERE order_id = ? AND batch_sequence_no = ? LIMIT 1`,
    [oid, seq],
  );

  if (existing?.length) {
    await conn.execute(
      `UPDATE tracking_id
       SET lr_number = ?, booking_url = ?, source = ?
       WHERE id = ?`,
      [lrNumber, url, source, existing[0].id],
    );
    return;
  }

  await conn.execute(
    `INSERT INTO tracking_id
      (order_id, lr_number, booking_url, source, batch_sequence_no)
     VALUES (?, ?, ?, ?, ?)`,
    [oid, lrNumber, url, source, seq],
  );
}
