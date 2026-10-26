import { isPerformaInvoice } from "@/lib/ledgerInvoiceFilters";

export function invoiceOwnedByUsername(invoice, username) {
  const u = String(username || "").trim().toLowerCase();
  if (!u) return false;
  const createdBy = String(invoice?.created_by || "").trim().toLowerCase();
  const employeeName = String(invoice?.employee_name || "").trim().toLowerCase();
  if (createdBy) return createdBy === u;
  return employeeName === u;
}

export function isAccountantRole(role) {
  return /ACCOUNTANT/.test(String(role || "").toUpperCase().trim());
}

/**
 * SUPERADMIN and ACCOUNTANT roles can see every performa invoice.
 * Other roles only see performa invoices they created.
 */
export function canSeeAllPerformaInvoices(payload) {
  const role = String(payload?.role || payload?.userRole || "")
    .toUpperCase()
    .trim();
  return role === "SUPERADMIN" || isAccountantRole(role);
}

/**
 * Non-performa invoices are not restricted by this helper.
 */
export function canAccessPerformaInvoice(payload, invoice) {
  if (!isPerformaInvoice(invoice)) return true;
  if (canSeeAllPerformaInvoices(payload)) return true;
  return invoiceOwnedByUsername(invoice, payload?.username);
}

/** SQL fragment + two bound username params for own-only performa. */
export const OWN_INVOICE_CREATOR_SQL =
  "(created_by = ? OR (created_by IS NULL AND employee_name = ?))";
