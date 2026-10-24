import { parseLinkedPurchaseTokens } from "@/lib/statementLinkedPurchases";
import { sqlUtf8TrimExpr } from "@/lib/sqlUtf8Compare";

function mergeInvoiceNumber(existingRaw, invoiceNumber) {
  const invNum = String(invoiceNumber || "").trim();
  if (!invNum) {
    return existingRaw != null ? String(existingRaw).trim() || null : null;
  }
  const existing = String(existingRaw || "").trim();
  if (!existing) return invNum;
  const parts = existing
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.some((p) => p === invNum)) return existing;
  return `${existing}, ${invNum}`;
}

/**
 * Mark bank statements as Settled for an invoice payment link (IP token + invoice_number).
 */
export async function settleStatementsForInvoicePayment(
  conn,
  { invoiceId, invoiceNumber, transIds = [] },
) {
  const invId = Number(invoiceId);
  if (!Number.isFinite(invId) || invId <= 0) return { updated: 0 };

  const ids = [
    ...new Set(
      (transIds || []).map((t) => String(t).trim()).filter(Boolean),
    ),
  ];
  if (!ids.length) return { updated: 0 };

  const ipToken = `IP${invId}`;
  const placeholders = ids.map(() => "?").join(", ");

  const [rows] = await conn.execute(
    `SELECT id, trans_id, linked_purchase_ids, invoice_number
     FROM statements
     WHERE ${sqlUtf8TrimExpr("trans_id")} IN (${placeholders})`,
    ids,
  );

  let updated = 0;
  for (const stmt of rows || []) {
    const tokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
    if (!tokens.includes(ipToken)) tokens.push(ipToken);
    const nextLinked = JSON.stringify(tokens);
    const nextInvoiceNumber = mergeInvoiceNumber(
      stmt.invoice_number,
      invoiceNumber,
    );

    await conn.execute(
      `UPDATE statements
       SET linked_purchase_ids = ?, invoice_status = ?, invoice_number = ?
       WHERE id = ?`,
      [nextLinked, "Settled", nextInvoiceNumber, stmt.id],
    );
    updated += 1;
  }

  return { updated };
}
