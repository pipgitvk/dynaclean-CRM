/**
 * Whether invoice should show as cancelled in UI (matches invoice list rules).
 */
export function isInvoiceCancelledDisplay(invoice) {
  if (!invoice) return false;
  if (String(invoice.status || "").trim().toUpperCase() === "CANCELLED") {
    return true;
  }
  if (invoice.is_cancelled_display === true) return true;
  return false;
}

function orderIsTerminated(row) {
  return (
    row &&
    (row.is_cancelled === 1 ||
      String(row.approval_status || "").trim().toLowerCase() === "rejected")
  );
}

/** Latest linked order row (same match keys as invoice list). */
async function fetchLatestLinkedOrder(conn, invoice) {
  const invNo = String(invoice.invoice_number || "").trim();
  const buyersOrderNo = String(invoice.buyers_order_no || "").trim();
  const quotationId =
    invoice.quotation_id != null ? String(invoice.quotation_id).trim() : "";

  if (!invNo && !buyersOrderNo && !quotationId) return null;

  const [rows] = await conn.execute(
    `SELECT no.is_cancelled, no.approval_status
     FROM neworder no
     LEFT JOIN quotations_records qr
       ON qr.quote_number = no.quote_number
     WHERE (
       (? <> '' AND TRIM(no.invoice_number) = ?)
       OR (
         ? <> ''
         AND TRIM(CAST(no.order_id AS CHAR)) = ?
       )
       OR (? <> '' AND TRIM(no.quote_number) = ?)
       OR (? <> '' AND CAST(qr.\`S.No.\` AS CHAR) = ?)
     )
     ORDER BY COALESCE(no.invoice_date, DATE(no.created_at)) DESC,
              no.created_at DESC,
              no.id DESC
     LIMIT 1`,
    [
      invNo,
      invNo,
      buyersOrderNo,
      buyersOrderNo,
      quotationId,
      quotationId,
      quotationId,
      quotationId,
    ],
  );
  return rows?.[0] || null;
}

/** Set is_cancelled_display from linked order when row status is not CANCELLED. */
export async function attachInvoiceCancelledDisplay(conn, invoice) {
  if (!invoice) return invoice;
  if (isInvoiceCancelledDisplay(invoice)) {
    return { ...invoice, is_cancelled_display: true };
  }

  try {
    const order = await fetchLatestLinkedOrder(conn, invoice);
    if (!orderIsTerminated(order)) return invoice;
    return { ...invoice, is_cancelled_display: true };
  } catch (err) {
    console.warn("[attachInvoiceCancelledDisplay]", err?.message);
    return invoice;
  }
}
