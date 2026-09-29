import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import NewInvoice from "@/components/invoice/DesignInvoice";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fetch invoice + items
async function getInvoiceWithItems(invoiceNumber) {
  const conn = await getDbConnection();

  // Invoice
  const [[invoice]] = await conn.execute(
    `
    SELECT *
    FROM invoices
    WHERE invoice_number = ?
    LIMIT 1
    `,
    [invoiceNumber],
  );

  if (!invoice) return null;

  // Resolve quotation number for reference field (supports both quote_number and internal quotation id)
  let resolvedQuoteNumber = invoice.quotation_id || null;
  let resolvedQuoteCreatedAt = null;
  if (invoice.quotation_id) {
    try {
      const [[byQuoteNumber]] = await conn.execute(
        `
        SELECT quote_number, created_at
        FROM quotations_records
        WHERE TRIM(quote_number) = TRIM(?)
        LIMIT 1
        `,
        [String(invoice.quotation_id)],
      );

      if (byQuoteNumber?.quote_number) {
        resolvedQuoteNumber = byQuoteNumber.quote_number;
        resolvedQuoteCreatedAt = byQuoteNumber.created_at || null;
      } else {
        const [[byLegacyId]] = await conn.execute(
          `
          SELECT quote_number, created_at
          FROM quotations_records
          WHERE TRIM(CAST(\`S.No.\` AS CHAR)) = TRIM(?)
          LIMIT 1
          `,
          [String(invoice.quotation_id)],
        );
        if (byLegacyId?.quote_number) {
          resolvedQuoteNumber = byLegacyId.quote_number;
          resolvedQuoteCreatedAt = byLegacyId.created_at || null;
        }
      }
    } catch {
      // Keep existing quotation_id as fallback if lookup fails
    }
  }

  // If we found the quote number but not the created date, try to resolve it once more.
  if (resolvedQuoteNumber && !resolvedQuoteCreatedAt) {
    try {
      const [[q]] = await conn.execute(
        `
        SELECT created_at
        FROM quotations_records
        WHERE TRIM(quote_number) = TRIM(?)
        LIMIT 1
        `,
        [String(resolvedQuoteNumber)],
      );
      resolvedQuoteCreatedAt = q?.created_at || null;
    } catch {
      // ignore
    }
  }

  // Invoice items (MULTIPLE)
  const [items] = await conn.execute(
    `
    SELECT *
    FROM invoice_items
    WHERE invoice_id = ?
    ORDER BY id ASC
    `,
    [invoice.id],
  );

  // --- Runtime recalculation of balance_amount and payment_status via linked statements ---
  let relatedInvoices = [{ id: invoice.id, number: invoice.invoice_number }];
  if (invoice.parent_id) {
    const [parent] = await conn.execute("SELECT id, invoice_number FROM invoices WHERE id = ? LIMIT 1", [invoice.parent_id]);
    if (parent.length > 0) relatedInvoices.push({ id: parent[0].id, number: parent[0].invoice_number });
    const [siblings] = await conn.execute("SELECT id, invoice_number FROM invoices WHERE parent_id = ?", [invoice.parent_id]);
    siblings.forEach(s => relatedInvoices.push({ id: s.id, number: s.invoice_number }));
  } else {
    const [children] = await conn.execute("SELECT id, invoice_number FROM invoices WHERE parent_id = ?", [invoice.id]);
    children.forEach(c => relatedInvoices.push({ id: c.id, number: c.invoice_number }));
  }
  const seenRelated = new Set();
  relatedInvoices = relatedInvoices.filter(inv => { if (seenRelated.has(inv.id)) return false; seenRelated.add(inv.id); return true; });

  const relatedGrandTotals = {};
  for (const inv of relatedInvoices) {
    if (inv.id === invoice.id) { relatedGrandTotals[inv.id] = Number(invoice.grand_total) || 0; }
    else { const [[rel]] = await conn.execute("SELECT grand_total FROM invoices WHERE id = ? LIMIT 1", [inv.id]); relatedGrandTotals[inv.id] = Number(rel?.grand_total) || 0; }
  }

  let linkedStatements = [];
  for (const inv of relatedInvoices) {
    const [stmts] = await conn.execute(
      "SELECT id, trans_id, amount, invoice_status, linked_purchase_ids FROM statements WHERE linked_purchase_ids LIKE ? OR invoice_number = ?",
      [`%IP${inv.id}%`, inv.number]
    );
    linkedStatements.push(...stmts);
  }
  const seenStmts = new Set();
  linkedStatements = linkedStatements.filter(s => { if (seenStmts.has(s.id)) return false; seenStmts.add(s.id); return true; });

  const invoiceRemainingMap = { ...relatedGrandTotals };
  const allocationMap = {};
  for (const stmt of linkedStatements) {
    let tokens = [];
    try { const raw = stmt.linked_purchase_ids; if (raw) { const p = Array.isArray(raw) ? raw : JSON.parse(raw); tokens = Array.isArray(p) ? p : [p]; } } catch { tokens = String(stmt.linked_purchase_ids || "").split(",").map(s => s.trim()); }
    const orderedIds = tokens.map(t => { const m = String(t).toUpperCase().match(/^IP(\d+)$/); return m ? parseInt(m[1]) : null; }).filter(id => id !== null && relatedGrandTotals[id] !== undefined);
    if (orderedIds.length === 0) orderedIds.push(invoice.id);
    let remaining = Math.abs(Number(stmt.amount) || 0);
    for (const invId of orderedIds) {
      if (remaining <= 0) break;
      const avail = invoiceRemainingMap[invId] || 0; if (avail <= 0) continue;
      const toAllocate = Math.min(avail, remaining);
      allocationMap[`${invId}-${stmt.trans_id}`] = (allocationMap[`${invId}-${stmt.trans_id}`] || 0) + toAllocate;
      invoiceRemainingMap[invId] -= toAllocate; remaining -= toAllocate;
    }
  }

  const totalAllocated = linkedStatements.reduce((sum, stmt) => sum + (allocationMap[`${invoice.id}-${stmt.trans_id}`] || 0), 0);
  const grandTotal = Number(invoice.grand_total) || 0;
  const computedBalance = Math.max(0, grandTotal - totalAllocated);
  let computedPaymentStatus = "UNPAID";
  if (grandTotal > 0) {
    if (computedBalance === 0) computedPaymentStatus = "PAID";
    else if (computedBalance < grandTotal) computedPaymentStatus = "PARTIAL";
  }
  // --- End recalculation ---

  return {
    ...invoice,
    balance_amount: computedBalance,
    payment_status: computedPaymentStatus,
    reference_quote_number: resolvedQuoteNumber,
    reference_quote_created_at: resolvedQuoteCreatedAt,
    items,
  };
}

export default async function InvoicePage({ params }) {
  const { invoiceId } = await params;
  const decodedInvoiceId = decodeURIComponent(invoiceId);

  //  Auth check
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return <p className="p-6 text-red-600">Unauthorized</p>;
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
  } catch {
    return <p className="p-6 text-red-600">Invalid token</p>;
  }

  //  Fetch invoice + items
  const invoiceData = await getInvoiceWithItems(decodedInvoiceId);

  if (!invoiceData) {
    return <p className="p-6 text-red-600">Invoice not found</p>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <NewInvoice invoice={invoiceData} />
    </div>
  );
}
