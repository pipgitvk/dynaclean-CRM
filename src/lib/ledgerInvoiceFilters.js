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
