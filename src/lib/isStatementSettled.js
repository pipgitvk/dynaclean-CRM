import { parseLinkedPurchaseTokens } from "@/lib/statementLinkedPurchases";

/** Matches admin StatementTable isSettledRow — use for unsettled payment pickers. */
export function isStatementSettled(row) {
  const linked = parseLinkedPurchaseTokens(row?.linked_purchase_ids);
  const inv = String(row?.invoice_status ?? "").trim();
  if (inv === "Settled") return true;
  if (row?.client_expense_id) return true;
  if (row?.dd_id) return true;
  if (row?.linked_module_id && row?.linked_module_type === "Assets") return true;
  if (linked.length > 0) return true;
  if (row?.invoice_number != null && String(row.invoice_number).trim() !== "") {
    return true;
  }
  if (
    row?.failed_transaction_id != null &&
    String(row.failed_transaction_id).trim() !== ""
  ) {
    return true;
  }
  if (
    row?.cancelled_transaction_id != null &&
    String(row.cancelled_transaction_id).trim() !== ""
  ) {
    return true;
  }
  return false;
}

export function isCreditStatement(row) {
  return String(row?.type || "").trim() === "Credit";
}

export function isDebitStatement(row) {
  return String(row?.type || "").trim() === "Debit";
}
