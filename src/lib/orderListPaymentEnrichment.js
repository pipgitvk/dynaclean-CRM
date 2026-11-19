import { attachActiveInvoiceFields } from "@/lib/activeInvoiceForOrder";
import { attachStatementPaymentsToOrders } from "@/lib/statementPaymentByTransId";

/** Invoice + statement fields required for order-list payment status (admin list parity). */
export async function enrichOrderListPaymentContext(conn, orders) {
  if (!Array.isArray(orders) || orders.length === 0) return orders;
  let rows = await attachActiveInvoiceFields(conn, orders);
  rows = await attachStatementPaymentsToOrders(conn, rows);
  return rows;
}