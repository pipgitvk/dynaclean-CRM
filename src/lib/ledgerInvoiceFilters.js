/** Proforma/performa invoices are excluded from party and buyer ledgers. */

export function isPerformaInvoice(invoice) {
  return String(invoice?.type || "").trim().toLowerCase() === "performa";
}

/** Use with invoices table, no alias */
export const EXCLUDE_PROFORMA_INVOICE_SQL =
  "(type IS NULL OR LOWER(TRIM(type)) <> 'performa')";

/** Use with invoices alias `i` */
export const EXCLUDE_PROFORMA_INVOICE_SQL_I =
  "(i.type IS NULL OR LOWER(TRIM(i.type)) <> 'performa')";

/** Cancelled invoices — invoices table, no alias */
export const EXCLUDE_CANCELLED_INVOICE_SQL =
  "(status IS NULL OR UPPER(TRIM(status)) <> 'CANCELLED')";

/** Cancelled invoices — alias `i` */
export const EXCLUDE_CANCELLED_INVOICE_SQL_I =
  "(i.status IS NULL OR UPPER(TRIM(i.status)) <> 'CANCELLED')";

const ORDER_TERMINATED_SQL = `
  (no.is_cancelled = 1 OR LOWER(COALESCE(no.approval_status, '')) = 'rejected')
`;

/** Invoice linked to a cancelled/rejected order (invoice list shows these as CANCELLED) */
export const EXCLUDE_ORDER_CANCELLED_INVOICE_SQL = `
  NOT EXISTS (
    SELECT 1 FROM neworder no
    WHERE ${ORDER_TERMINATED_SQL}
      AND invoices.invoice_number IS NOT NULL
      AND TRIM(invoices.invoice_number) <> ''
      AND TRIM(no.invoice_number) COLLATE utf8mb4_unicode_ci = TRIM(invoices.invoice_number) COLLATE utf8mb4_unicode_ci
  )
  AND NOT EXISTS (
    SELECT 1 FROM neworder no
    WHERE ${ORDER_TERMINATED_SQL}
      AND invoices.buyers_order_no IS NOT NULL
      AND TRIM(invoices.buyers_order_no) <> ''
      AND TRIM(CAST(no.order_id AS CHAR)) COLLATE utf8mb4_unicode_ci = TRIM(invoices.buyers_order_no) COLLATE utf8mb4_unicode_ci
  )
`;

export const EXCLUDE_ORDER_CANCELLED_INVOICE_SQL_I = `
  NOT EXISTS (
    SELECT 1 FROM neworder no
    WHERE ${ORDER_TERMINATED_SQL}
      AND i.invoice_number IS NOT NULL
      AND TRIM(i.invoice_number) <> ''
      AND TRIM(no.invoice_number) COLLATE utf8mb4_unicode_ci = TRIM(i.invoice_number) COLLATE utf8mb4_unicode_ci
  )
  AND NOT EXISTS (
    SELECT 1 FROM neworder no
    WHERE ${ORDER_TERMINATED_SQL}
      AND i.buyers_order_no IS NOT NULL
      AND TRIM(i.buyers_order_no) <> ''
      AND TRIM(CAST(no.order_id AS CHAR)) COLLATE utf8mb4_unicode_ci = TRIM(i.buyers_order_no) COLLATE utf8mb4_unicode_ci
  )
`;

/** Proforma + cancelled row/order — parties / party ledger */
export const LEDGER_INVOICE_SQL = `${EXCLUDE_PROFORMA_INVOICE_SQL} AND ${EXCLUDE_CANCELLED_INVOICE_SQL} AND ${EXCLUDE_ORDER_CANCELLED_INVOICE_SQL}`;

export const LEDGER_INVOICE_SQL_I = `${EXCLUDE_PROFORMA_INVOICE_SQL_I} AND ${EXCLUDE_CANCELLED_INVOICE_SQL_I} AND ${EXCLUDE_ORDER_CANCELLED_INVOICE_SQL_I}`;
