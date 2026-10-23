/** Optional per-carrier tracking on neworder (Delivery uses booking_id / booking_url). */

const ALTERS = [
  "ALTER TABLE neworder ADD COLUMN porter_delivery VARCHAR(255) NULL",
  "ALTER TABLE neworder ADD COLUMN porter_delivery_url VARCHAR(500) NULL",
  "ALTER TABLE neworder ADD COLUMN wheelseye_delivery VARCHAR(255) NULL",
  "ALTER TABLE neworder ADD COLUMN wheelseye_delivery_url VARCHAR(500) NULL",
];

export async function ensureOrderShipmentTrackingColumns(conn) {
  for (const sql of ALTERS) {
    try {
      await conn.execute(sql);
    } catch (_) {
      /* column exists */
    }
  }
}
