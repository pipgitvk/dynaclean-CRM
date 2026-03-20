import { getDbConnection } from "@/lib/db";

/**
 * Order "Total Amount" from neworder.totalamt (same as user-dashboard order detail).
 * customer_id comes from quotations_records via quote_number.
 */
export async function getOrderProspectAmountContext(orderIdRaw) {
  const orderId = String(orderIdRaw ?? "").trim();
  if (!orderId) return null;

  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    `SELECT no.totalamt, no.quote_number, qr.customer_id
     FROM neworder no
     LEFT JOIN quotations_records qr ON no.quote_number = qr.quote_number
     WHERE no.order_id = ?
     LIMIT 1`,
    [orderId],
  );

  const r = rows?.[0];
  if (!r) return null;

  let total_amount =
    r.totalamt != null && r.totalamt !== "" ? Number(r.totalamt) : null;
  if (total_amount != null && Number.isNaN(total_amount)) total_amount = null;

  const customer_id =
    r.customer_id != null && r.customer_id !== ""
      ? String(r.customer_id).trim()
      : null;

  return {
    order_id: orderId,
    quote_number: r.quote_number ?? null,
    customer_id,
    total_amount,
  };
}
