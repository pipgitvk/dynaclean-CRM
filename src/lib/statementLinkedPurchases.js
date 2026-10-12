/**
 * Parse statements.linked_purchase_ids (JSON array or comma string) into normalized tokens.
 * Supports invoice (IP), purchase (PP/PS/SP) prefixes.
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
    if (/^(IP|PP|PS|SP)\d+$/.test(s)) {
      out.push(s.startsWith("SP") ? `PS${s.slice(2)}` : s);
    } else if (/^\d+$/.test(s)) {
      out.push(`PP${s}`);
    }
  }
  return out;
}

/** Parse product_stock_request.linked_statement_ids JSON or comma string */
export function parseLinkedStatementIds(rawVal) {
  if (rawVal == null || String(rawVal).trim() === "") return [];
  if (Array.isArray(rawVal)) return rawVal.filter((v) => v != null && String(v).trim() !== "");
  try {
    const parsed = JSON.parse(String(rawVal));
    if (Array.isArray(parsed)) {
      return parsed.filter((v) => v != null && String(v).trim() !== "");
    }
  } catch {
    // fall through to comma split
  }
  return String(rawVal)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse invoices.linked_trans_ids JSON or comma string → array of trans_id strings */
export function parseLinkedTransIds(rawVal) {
  if (rawVal == null || String(rawVal).trim() === "") return [];
  if (Array.isArray(rawVal)) return rawVal.filter(Boolean).map(String);
  try {
    const parsed = JSON.parse(String(rawVal));
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
  } catch {
    // fall through to comma split
  }
  return String(rawVal)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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
