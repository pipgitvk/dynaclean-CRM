import { ensureOrderLinkedPaymentColumns } from "@/lib/ensureOrderLinkedPaymentColumns";

function sumCsvAmounts(raw) {
  if (raw == null || String(raw).trim() === "") return 0;
  return String(raw)
    .split(",")
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => a + b, 0);
}

/** Persist booking UTR/amount so order list Linked Payment shows trans_id (prod-safe). */
export async function seedOrderBookingPaymentSnapshot(
  conn,
  orderId,
  { transactionId, paymentDate, paymentAmount },
) {
  const tid = String(transactionId || "").trim();
  const paid = sumCsvAmounts(paymentAmount);
  if (!orderId || !tid || paid <= 0) return;

  await ensureOrderLinkedPaymentColumns(conn);

  const dateStr = paymentDate
    ? String(paymentDate).split(",")[0].trim().slice(0, 10)
    : null;
  const snapshot = JSON.stringify([
    {
      statement_id: null,
      trans_id: tid,
      date: dateStr,
      amount: paid,
    },
  ]);

  await conn.execute(
    `UPDATE neworder SET
      linked_payments_json = ?,
      amount_received = COALESCE(amount_received, ?),
      payment_received_date = COALESCE(payment_received_date, ?)
     WHERE order_id = ?`,
    [snapshot, paid, dateStr, orderId],
  );
}
