import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import NewInvoice from "@/components/invoice/DesignInvoice";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fetch invoice + items + linked statements
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
  
  // Get all related invoice IDs and numbers: this invoice, parent, and children
  let relatedInvoices = [{id: invoice.id, number: invoice.invoice_number}];
  if (invoice.parent_id) {
    // If this invoice has a parent, get parent and all siblings
    const [parent] = await conn.execute(
      "SELECT id, invoice_number FROM invoices WHERE id = ?",
      [invoice.parent_id]
    );
    if (parent.length > 0) {
      relatedInvoices.push({id: parent[0].id, number: parent[0].invoice_number});
    }
    // Get all siblings (invoices with same parent)
    const [siblings] = await conn.execute(
      "SELECT id, invoice_number FROM invoices WHERE parent_id = ?",
      [invoice.parent_id]
    );
    siblings.forEach(s => relatedInvoices.push({id: s.id, number: s.invoice_number}));
  } else {
    // If this invoice is a parent, get all its children
    const [children] = await conn.execute(
      "SELECT id, invoice_number FROM invoices WHERE parent_id = ?",
      [invoice.id]
    );
    children.forEach(c => relatedInvoices.push({id: c.id, number: c.invoice_number}));
  }
  // Remove duplicates
  const uniqueRelatedInvoices = [];
  const seenInvoiceIds = new Set();
  for (const inv of relatedInvoices) {
    if (!seenInvoiceIds.has(inv.id)) {
      seenInvoiceIds.add(inv.id);
      uniqueRelatedInvoices.push(inv);
    }
  }
  
  // Linked statements
  let linkedStatements = [];
  for (const inv of uniqueRelatedInvoices) {
    const [stmts] = await conn.execute(
      "SELECT id, trans_id, date, description, amount, invoice_status, linked_purchase_ids FROM statements WHERE linked_purchase_ids LIKE ? OR invoice_number = ?",
      [`%IP${inv.id}%`, inv.number]
    );
    linkedStatements.push(...stmts);
  }
  
  // Remove duplicate statements
  const uniqueLinkedStatements = [];
  const seenStmtIds = new Set();
  for (const stmt of linkedStatements) {
    if (!seenStmtIds.has(stmt.id)) {
      seenStmtIds.add(stmt.id);
      uniqueLinkedStatements.push(stmt);
    }
  }
  linkedStatements = uniqueLinkedStatements;

  // --- Runtime recalculation of balance_amount and payment_status ---
  // Build a map of grand_total for all related invoices (for waterfall allocation)
  const relatedInvoiceGrandTotals = {};
  for (const inv of uniqueRelatedInvoices) {
    if (inv.id === invoice.id) {
      relatedInvoiceGrandTotals[inv.id] = Number(invoice.grand_total) || 0;
    } else {
      const [[relInv]] = await conn.execute(
        "SELECT grand_total FROM invoices WHERE id = ? LIMIT 1",
        [inv.id]
      );
      relatedInvoiceGrandTotals[inv.id] = Number(relInv?.grand_total) || 0;
    }
  }

  // Waterfall allocation: distribute each statement's amount across related invoices in id order
  const invoiceRemainingMap = { ...relatedInvoiceGrandTotals };
  const allocationMap = {}; // key: `${invoiceId}-${trans_id}` → allocated amount

  for (const stmt of linkedStatements) {
    // Parse linked_purchase_ids to get ordered invoice ids
    let tokens = [];
    try {
      const raw = stmt.linked_purchase_ids;
      if (raw) {
        const parsed = Array.isArray(raw) ? raw : JSON.parse(raw);
        tokens = Array.isArray(parsed) ? parsed : [parsed];
      }
    } catch {
      tokens = String(stmt.linked_purchase_ids || "").split(",").map(s => s.trim());
    }
    const orderedIds = tokens
      .map(t => {
        const m = String(t).toUpperCase().match(/^IP(\d+)$/);
        return m ? parseInt(m[1]) : null;
      })
      .filter(id => id !== null && relatedInvoiceGrandTotals[id] !== undefined);

    // Also include this invoice if matched by invoice_number but not token
    if (orderedIds.length === 0) orderedIds.push(invoice.id);

    let remaining = Math.abs(Number(stmt.amount) || 0);
    for (const invId of orderedIds) {
      if (remaining <= 0) break;
      const avail = invoiceRemainingMap[invId] || 0;
      if (avail <= 0) continue;
      const toAllocate = Math.min(avail, remaining);
      allocationMap[`${invId}-${stmt.trans_id}`] = (allocationMap[`${invId}-${stmt.trans_id}`] || 0) + toAllocate;
      invoiceRemainingMap[invId] -= toAllocate;
      remaining -= toAllocate;
    }
  }

  // Calculate this invoice's allocated total
  const totalAllocated = linkedStatements.reduce((sum, stmt) => {
    return sum + (allocationMap[`${invoice.id}-${stmt.trans_id}`] || 0);
  }, 0);

  const grandTotal = Number(invoice.grand_total) || 0;
  const computedBalance = Math.max(0, grandTotal - totalAllocated);

  let computedPaymentStatus = "UNPAID";
  if (grandTotal > 0) {
    if (computedBalance === 0) {
      computedPaymentStatus = "PAID";
    } else if (computedBalance < grandTotal) {
      computedPaymentStatus = "PARTIAL";
    }
  }
  // --- End recalculation ---

  return {
    ...invoice,
    balance_amount: computedBalance,
    payment_status: computedPaymentStatus,
    reference_quote_number: resolvedQuoteNumber,
    reference_quote_created_at: resolvedQuoteCreatedAt,
    items,
    linkedStatements,
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
