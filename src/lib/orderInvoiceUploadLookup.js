import { EXCLUDE_PROFORMA_INVOICE_SQL } from "@/lib/ledgerInvoiceFilters";
import { lookupInvoiceLinkedPayment } from "@/lib/invoiceLinkedPaymentLookup";
import { linkedPaymentsToOrderPaymentCsv } from "@/lib/orderPaymentHistory";
import { resolveInvoiceNumberForOrder } from "@/lib/resolveInvoiceNumberForOrder";

function formatDateOnly(val) {
  if (!val) return null;
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function fetchLatestInvoiceForOrder(conn, order) {
  const invNum = await resolveInvoiceNumberForOrder(conn, order);
  if (!invNum) return null;

  const [byNumber] = await conn.execute(
    `SELECT id, invoice_number, invoice_date, subtotal, cgst, sgst, igst, total_tax, grand_total
     FROM invoices
     WHERE TRIM(invoice_number) = ?
       AND ${EXCLUDE_PROFORMA_INVOICE_SQL}
       AND (status IS NULL OR UPPER(TRIM(status)) <> 'CANCELLED')
     ORDER BY id DESC
     LIMIT 1`,
    [invNum],
  );
  return byNumber?.[0] || null;
}

export async function lookupOrderUploadPrefill(conn, orderIdRaw) {
  const orderId = String(orderIdRaw || "").trim();
  if (!orderId) return { found: false };

  const [orderRows] = await conn.execute(
    `SELECT order_id, quote_number, invoice_number, invoice_date, duedate
     FROM neworder WHERE order_id = ? LIMIT 1`,
    [orderId],
  );
  if (!orderRows?.length) return { found: false };
  const order = orderRows[0];

  const inv = await fetchLatestInvoiceForOrder(conn, order);
  if (!inv) return { found: false };

  const baseAmount = Number(inv.subtotal) || 0;
  const taxFromParts =
    (Number(inv.cgst) || 0) +
    (Number(inv.sgst) || 0) +
    (Number(inv.igst) || 0);
  const taxamt = Number(inv.total_tax) || taxFromParts || 0;
  const totalamt = Number(inv.grand_total) || baseAmount + taxamt;

  const invoiceNumber = String(inv.invoice_number || "").trim();
  const linked = await lookupInvoiceLinkedPayment(conn, invoiceNumber);
  const csv = linkedPaymentsToOrderPaymentCsv(linked?.payments || []);

  let payment_amount = csv.payment_amount || null;
  if (!payment_amount && linked?.payment_amount > 0) {
    payment_amount = String(Number(linked.payment_amount));
  }

  const payment_id = csv.payment_id || linked?.payment_id || null;
  const payment_date = csv.payment_date || linked?.payment_date || null;

  const invoice_date =
    formatDateOnly(inv.invoice_date) ||
    formatDateOnly(order.invoice_date) ||
    formatDateOnly(order.duedate);

  return {
    found: true,
    invoice_number: invoiceNumber,
    invoice_date,
    baseAmount,
    taxamt,
    totalamt,
    payment_id,
    payment_date,
    payment_amount,
  };
}
