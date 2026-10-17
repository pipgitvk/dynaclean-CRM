export async function ensureOrderLinkedPaymentColumns(conn) {
  try {
    await conn.execute(
      "ALTER TABLE neworder ADD COLUMN amount_received DECIMAL(15,2) NULL DEFAULT NULL",
    );
  } catch (_) {}
  try {
    await conn.execute(
      "ALTER TABLE neworder ADD COLUMN payment_received_date DATE NULL DEFAULT NULL",
    );
  } catch (_) {}
  try {
    await conn.execute(
      "ALTER TABLE neworder ADD COLUMN linked_payments_json TEXT NULL DEFAULT NULL",
    );
  } catch (_) {}
}
