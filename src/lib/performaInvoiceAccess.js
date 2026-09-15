import { isPerformaInvoice } from "@/lib/ledgerInvoiceFilters";

export function invoiceOwnedByUsername(invoice, username) {
  const u = String(username || "").trim().toLowerCase();
  if (!u) return false;
  const createdBy = String(invoice?.created_by || "").trim().toLowerCase();
  const employeeName = String(invoice?.employee_name || "").trim().toLowerCase();
  if (createdBy) return createdBy === u;
  return employeeName === u;
}

/**
 * SUPERADMIN can see every performa invoice.
 * ADMIN and all other roles only see performa invoices they created.
 * Non-performa invoices are not restricted by this helper.
 */
export function canAccessPerformaInvoice(payload, invoice) {
  if (!isPerformaInvoice(invoice)) return true;
  const role = String(payload?.role || payload?.userRole || "")
    .toUpperCase()
    .trim();
  if (role === "SUPERADMIN") return true;
  return invoiceOwnedByUsername(invoice, payload?.username);
}

/** SQL fragment + two bound username params for own-only performa. */
export const OWN_INVOICE_CREATOR_SQL =
  "(created_by = ? OR (created_by IS NULL AND employee_name = ?))";
