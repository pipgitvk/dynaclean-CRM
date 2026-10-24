/**
 * One-time: orders with booking UTR (transaction_id/payment_id + payment_amount)
 * but empty linked_payments_json / amount_received.
 *
 * Usage: node scripts/backfill-order-booking-linked-payments.js
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

function sumCsv(raw) {
  if (raw == null || String(raw).trim() === "") return 0;
  return String(raw)
    .split(",")
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => a + b, 0);
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [rows] = await connection.execute(
    `SELECT order_id, transaction_id, payment_id, payment_date, payment_amount,
            amount_received, linked_payments_json
     FROM neworder
     WHERE (linked_payments_json IS NULL OR linked_payments_json = '' OR linked_payments_json = '[]')
       AND (amount_received IS NULL OR amount_received = 0)
       AND (
         (transaction_id IS NOT NULL AND TRIM(transaction_id) != '')
         OR (payment_id IS NOT NULL AND TRIM(payment_id) != '')
       )
       AND payment_amount IS NOT NULL AND TRIM(payment_amount) != ''`,
  );

  let updated = 0;
  for (const row of rows) {
    const paid = sumCsv(row.payment_amount);
    if (paid <= 0) continue;
    const tid =
      String(row.payment_id || "").split(",")[0].trim() ||
      String(row.transaction_id || "").trim();
    if (!tid) continue;
    const dateStr = row.payment_date
      ? String(row.payment_date).split(",")[0].trim().slice(0, 10)
      : null;
    const snapshot = JSON.stringify([
      { statement_id: null, trans_id: tid, date: dateStr, amount: paid },
    ]);
    await connection.execute(
      `UPDATE neworder SET linked_payments_json = ?, amount_received = ?, payment_received_date = COALESCE(payment_received_date, ?)
       WHERE order_id = ?`,
      [snapshot, paid, dateStr, row.order_id],
    );
    updated++;
    console.log("Updated", row.order_id, tid, paid);
  }

  console.log(`Done. Updated ${updated} of ${rows.length} candidate rows.`);
  await connection.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
