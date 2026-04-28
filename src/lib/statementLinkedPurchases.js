/**
 * Parse statements.linked_purchase_ids (JSON array or comma string) into normalized PP/PS tokens.
 * Mirrors PATCH logic on /api/statements/[id].
 */
export function parseLinkedPurchaseTokens(rawVal) {
  if (rawVal == null || String(rawVal).trim() === "") return [];
  let arr = null;
  try {
    const parsed = JSON.parse(String(rawVal));
    if (Array.isArray(parsed)) arr = parsed;
  } catch {
    arr = String(rawVal)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const out = [];
  for (const v of arr || []) {
    if (v == null) continue;
    const s = String(v).trim().toUpperCase();
    if (!s) continue;
    if (/^(PP|PS|SP)\d+$/.test(s)) {
      out.push(s.startsWith("SP") ? `PS${s.slice(2)}` : s);
    } else if (/^\d+$/.test(s)) {
      out.push(`PP${s}`);
    }
  }
  return out;
}

/**
 * DB invoice_status for a statement: settled if linked to purchases or to a client expense.
 */
export function deriveStatementInvoiceStatus(linkedPurchasesRaw, clientExpenseId) {
  const tokens = parseLinkedPurchaseTokens(linkedPurchasesRaw);
  if (tokens.length > 0) return "Settled";
  const eid = clientExpenseId != null ? Number(clientExpenseId) : null;
  if (eid != null && Number.isFinite(eid) && eid >= 1) return "Settled";
  return "Unsettled";
}
