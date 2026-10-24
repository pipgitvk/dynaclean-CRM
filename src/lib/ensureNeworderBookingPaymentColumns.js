/** Booking-time payment fields on neworder (PO / UTR at order create). */
export async function ensureNeworderBookingPaymentColumns(conn) {
  const alters = [
    "ALTER TABLE neworder ADD COLUMN po_number VARCHAR(255) NULL DEFAULT NULL",
    "ALTER TABLE neworder ADD COLUMN payment_date VARCHAR(500) NULL DEFAULT NULL",
    "ALTER TABLE neworder ADD COLUMN transaction_id VARCHAR(255) NULL DEFAULT NULL",
    "ALTER TABLE neworder ADD COLUMN payment_id VARCHAR(500) NULL DEFAULT NULL",
    "ALTER TABLE neworder ADD COLUMN payment_amount VARCHAR(500) NULL DEFAULT NULL",
    "ALTER TABLE neworder ADD COLUMN payment_status VARCHAR(50) NULL DEFAULT NULL",
  ];
  for (const sql of alters) {
    try {
      await conn.execute(sql);
    } catch (_) {
      /* column exists */
    }
  }
}
