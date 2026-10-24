import { ensureOrderLinkedPaymentColumns } from "@/lib/ensureOrderLinkedPaymentColumns";
import { syncInvoicePaymentFromOrder } from "@/lib/syncInvoicePaymentFromOrder";
import {
  syncOrderLinkedPaymentFromInvoice,
  syncOrdersForInvoiceNumbers,
} from "@/lib/syncOrderLinkedPaymentFromInvoice";
import { sumPaymentAmountCsv } from "@/lib/orderPaymentHistory";

/**
 * Keep invoice payment link and order linked-payment snapshot aligned.
 * Always sync invoice → order first; only push order → invoice when order has paid > 0.
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
    const [rows] = await conn.execute(
      `SELECT order_id, quote_number, invoice_number, totalamt, amount_received,
              payment_received_date, linked_payments_json, payment_id, payment_date,
              payment_amount, payment_status, transaction_id
       FROM neworder WHERE order_id = ? LIMIT 1`,
      [orderId],
    );
    if (!rows?.[0]) continue;

    // Invoice → order first (so Link Payment amount lands on neworder).
    const synced = await syncOrderLinkedPaymentFromInvoice(conn, rows[0]);

    const paid =
      sumPaymentAmountCsv(synced?.payment_amount) ||
      Number(synced?.amount_received) ||
      0;
    // Only push order → invoice when order actually has money (avoid wiping invoice).
    if (paid > 0) {
      await syncInvoicePaymentFromOrder(conn, orderId);
    }
  }
}
