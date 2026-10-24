import { ensureOrderLinkedPaymentColumns } from "@/lib/ensureOrderLinkedPaymentColumns";
import { syncInvoicePaymentFromOrder } from "@/lib/syncInvoicePaymentFromOrder";
import {
  syncOrderLinkedPaymentFromInvoice,
  syncOrdersForInvoiceNumbers,
} from "@/lib/syncOrderLinkedPaymentFromInvoice";

/**
 * Keep invoice payment link and order linked-payment snapshot aligned (merge only).
 */
export async function syncInvoiceAndOrderPaymentLink(
  conn,
  { invoiceNumbers = [], orderIds = [] } = {},
) {
  await ensureOrderLinkedPaymentColumns(conn);

  const nums = [
    ...new Set(
      (invoiceNumbers || []).map((n) => String(n || "").trim()).filter(Boolean),
    ),
  ];
  if (nums.length) {
    await syncOrdersForInvoiceNumbers(conn, nums);
  }

  const orders = [
    ...new Set(
      (orderIds || []).map((id) => String(id || "").trim()).filter(Boolean),
    ),
  ];
  for (const orderId of orders) {
    await syncInvoicePaymentFromOrder(conn, orderId);
    const [rows] = await conn.execute(
      `SELECT order_id, quote_number, invoice_number, totalamt, amount_received,
              payment_received_date, linked_payments_json, payment_id, payment_date,
              payment_amount, payment_status
       FROM neworder WHERE order_id = ? LIMIT 1`,
      [orderId],
    );
    if (rows?.[0]) {
      await syncOrderLinkedPaymentFromInvoice(conn, rows[0]);
    }
  }
}
