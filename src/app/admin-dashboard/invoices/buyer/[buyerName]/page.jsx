  import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import BuyerInvoiceTable from "./BuyerInvoiceTable";
import BuyerLedgerTable from "./BuyerLedgerTable";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { buyerName } = await params;
  return { title: `Invoices – ${decodeURIComponent(buyerName)} | DynaClean CRM` };
}

/** Parse linked_trans_ids JSON or plain string → array of strings */
function parseTransIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter(Boolean).map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Parse linked_purchase_ids (JSON, comma-separated, or single token) → array of strings */
function parseLinkedPurchaseIds(raw) {
  if (!raw) return [];
  let arr = null;
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      arr = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      arr = raw.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  if (!arr) return [];
  const keys = [];
  for (const v of arr) {
    if (v == null) continue;
    const s = String(v).trim().toUpperCase();
    if (!s) continue;
    if (/^(IP|PP|PS|SP)\d+$/.test(s)) {
      keys.push(s);
    } else if (/^\d+$/.test(s)) {
      keys.push(`IP${s}`);
    }
  }
  return keys;
}

export default async function BuyerInvoicesPage({ params }) {
  const { buyerName } = await params;
  const decodedBuyer = decodeURIComponent(buyerName).trim();

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return <p className="text-red-600 p-4">Unauthorized</p>;

  try {
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
  } catch {
    return <p className="text-red-600 p-4">Invalid Token</p>;
  }

  let invoices = [];
  let ledgerEntries = [];
  let customerIdForBuyer = null;

  try {
    const conn = await getDbConnection();

    // ── 1. Invoices for this buyer ──────────────────────────────
    const [invRows] = await conn.execute(
      `SELECT
         id,
         invoice_number,
         employee_name,
         COALESCE(order_date, invoice_date) AS order_date,
         (COALESCE(cgst,0) + COALESCE(sgst,0) + COALESCE(igst,0)) AS tax_amount,
         grand_total,
         linked_trans_ids,
         billing_address,
         customer_id,
         DATE(created_at) AS created_date,
         created_at
       FROM invoices
       WHERE TRIM(customer_name) = ? OR customer_name = ?
       ORDER BY COALESCE(order_date, invoice_date) DESC, id DESC`,
      [decodedBuyer, decodedBuyer]
    );
    invoices = invRows;

    // Capture customer_id from first invoice (if available)
    if (invoices.length > 0 && invoices[0].customer_id) {
      customerIdForBuyer = invoices[0].customer_id;
    }

    // Fallback: if invoice has no customer_id, look it up from product_stock_request by client_name
    if (!customerIdForBuyer) {
      const [cRows] = await conn.execute(
        `SELECT customer_id FROM product_stock_request 
         WHERE TRIM(client_name) = ? AND customer_id IS NOT NULL AND customer_id != 0
         LIMIT 1`,
        [decodedBuyer]
      );
      if (cRows.length > 0) {
        customerIdForBuyer = cRows[0].customer_id;
      }
    }

    // ── 2. Collect all relevant statements for this buyer ──────
    const buyerInvoiceIds = new Set(invoices.map(i => i.id));
    const buyerInvoiceNumbers = new Set(invoices.map(i => i.invoice_number).filter(Boolean));

    // Fetch all statements first
    const [allStatements] = await conn.execute(
      `SELECT id, trans_id, date, amount, description, type, linked_purchase_ids, invoice_number, invoice_status
       FROM statements
       ORDER BY date ASC, id ASC`
    );
    
    console.log("[Buyer Page] All statements count:", allStatements.length);
    console.log("[Buyer Page] Buyer invoice IDs:", [...buyerInvoiceIds]);
    console.log("[Buyer Page] Buyer invoice numbers:", [...buyerInvoiceNumbers]);
    console.log("[Buyer Page] First invoice details:", invoices[0]);

    // Filter to get only statements relevant to this buyer
    let statementRows = allStatements.filter(stmt => {
      const inLinkedTransIds = invoices.some(inv => {
        const invLinkedTransIds = parseTransIds(inv.linked_trans_ids);
        const includes = invLinkedTransIds.includes(stmt.trans_id);
        if (includes) {
          console.log(`[Buyer Page] Statement ${stmt.id} (${stmt.trans_id}) in invoice ${inv.id}'s linked_trans_ids:`, invLinkedTransIds);
        }
        return includes;
      });
      const matchesInvoiceNumber = stmt.invoice_number && buyerInvoiceNumbers.has(stmt.invoice_number);
      const linkedPurchaseTokens = parseLinkedPurchaseIds(stmt.linked_purchase_ids);
      const hasLinkedInvoiceId = linkedPurchaseTokens.some(token => {
        if (token.startsWith("IP")) {
          const invId = parseInt(token.replace("IP", ""));
          const has = buyerInvoiceIds.has(invId);
          if (has) {
            console.log(`[Buyer Page] Statement ${stmt.id} (${stmt.trans_id}) has linked_purchase_ids token ${token} matching invoice ${invId}`);
          }
          return has;
        }
        return false;
      });
      const isRelevant = inLinkedTransIds || matchesInvoiceNumber || hasLinkedInvoiceId;
      if (isRelevant) {
        console.log("[Buyer Page] Found relevant statement:", { id: stmt.id, trans_id: stmt.trans_id, amount: stmt.amount, linked_purchase_ids: stmt.linked_purchase_ids, invoice_number: stmt.invoice_number, linkedPurchaseTokens, inLinkedTransIds, matchesInvoiceNumber, hasLinkedInvoiceId });
      } else {
        // Log statements with trans_id S2671864 specifically (the settled one)
        if (stmt.trans_id === "S2671864" || stmt.id === 6993) {
          console.log("[Buyer Page] EXCLUDING statement 6993/S2671864:", {
            id: stmt.id, trans_id: stmt.trans_id, amount: stmt.amount,
            linked_purchase_ids: stmt.linked_purchase_ids, invoice_number: stmt.invoice_number,
            linkedPurchaseTokens, inLinkedTransIds, matchesInvoiceNumber, hasLinkedInvoiceId
          });
        }
      }
      return isRelevant;
    });
    console.log("[Buyer Page] Filtered statement rows count:", statementRows.length);

    // ── 3. Fetch ALL invoices linked to these statements (for amount allocation)
    let allLinkedInvoices = [];
    if (statementRows.length > 0) {
      const allLinkedInvoiceIds = new Set();
      const allLinkedInvoiceNumbers = new Set();
      for (const stmt of statementRows) {
        const tokens = parseTransIds(stmt.linked_purchase_ids);
        for (const token of tokens) {
          if (token.startsWith("IP")) {
            allLinkedInvoiceIds.add(parseInt(token.replace("IP", "")));
          }
        }
        if (stmt.invoice_number) {
          allLinkedInvoiceNumbers.add(stmt.invoice_number);
        }
      }
      // Include all buyer's invoices too
      invoices.forEach(inv => {
        allLinkedInvoiceIds.add(inv.id);
        if (inv.invoice_number) allLinkedInvoiceNumbers.add(inv.invoice_number);
      });

      // Build query to get all linked invoices
      let queryParts = [];
      let queryParams = [];
      if (allLinkedInvoiceIds.size > 0) {
        const placeholdersInv = Array.from(allLinkedInvoiceIds).map(() => "?").join(",");
        queryParts.push(`id IN (${placeholdersInv})`);
        queryParams.push(...Array.from(allLinkedInvoiceIds));
      }
      if (allLinkedInvoiceNumbers.size > 0) {
        const placeholdersInvNum = Array.from(allLinkedInvoiceNumbers).map(() => "?").join(",");
        queryParts.push(`invoice_number IN (${placeholdersInvNum})`);
        queryParams.push(...Array.from(allLinkedInvoiceNumbers));
      }

      if (queryParts.length > 0) {
        const [allInvRows] = await conn.execute(
          `SELECT id, grand_total, linked_trans_ids, invoice_number
           FROM invoices
           WHERE ${queryParts.join(" OR ")}`,
          queryParams
        );
        allLinkedInvoices = allInvRows;
      }
    }

    // ── 4. Create allocation maps
    const invoiceMap = {};
    const invoiceNumberToIdMap = {};
    for (const inv of allLinkedInvoices) {
      invoiceMap[inv.id] = inv;
      if (inv.invoice_number) invoiceNumberToIdMap[inv.invoice_number] = inv.id;
    }

    // Create a map of trans_id -> linked invoice ids (PRIORITIZE current buyer's invoices)
    const transToInvoiceIdsMap = {};
    for (const stmt of statementRows) {
      const allIdsInOrder = [];
      const seenIds = new Set();
      // Add from linked_purchase_ids (IN ORDER)
      const tokens = parseLinkedPurchaseIds(stmt.linked_purchase_ids);
      for (const token of tokens) {
        if (token.startsWith("IP")) {
          const invId = parseInt(token.replace("IP", ""));
          if (invoiceMap[invId] && !seenIds.has(invId)) {
            allIdsInOrder.push(invId);
            seenIds.add(invId);
          }
        }
      }
      // Add from invoice_number (if not already added)
      if (stmt.invoice_number && invoiceNumberToIdMap[stmt.invoice_number]) {
        const invId = invoiceNumberToIdMap[stmt.invoice_number];
        if (!seenIds.has(invId)) {
          allIdsInOrder.push(invId);
          seenIds.add(invId);
        }
      }
      // Split into buyer's invoices and others, preserving order
      const buyerIds = [];
      const otherIds = [];
      for (const invId of allIdsInOrder) {
        if (buyerInvoiceIds.has(invId)) {
          buyerIds.push(invId);
        } else {
          otherIds.push(invId);
        }
      }
      // Combine: buyer's invoices first, then others
      transToInvoiceIdsMap[stmt.trans_id] = [...buyerIds, ...otherIds];
    }

    // Calculate allocation map: key `${invId}-${transId}` -> allocated amount
    const allocationMap = {};
    // Track remaining balance for each invoice across all statements
    const invoiceRemainingMap = {};
    // Initialize remaining balance for each invoice to grand total
    for (const invId in invoiceMap) {
      invoiceRemainingMap[invId] = Number(invoiceMap[invId].grand_total) || 0;
      console.log(`[Buyer Page] Invoice ${invId} (${invoiceMap[invId].invoice_number}) initialized with grand total ${invoiceMap[invId].grand_total}`);
    }
    console.log("[Buyer Page] Initial invoiceRemainingMap:", invoiceRemainingMap);

    // Process statements in order (ascending by id/date)
    for (const stmt of statementRows) {
      console.log(`[Buyer Page] Processing statement ${stmt.id} (${stmt.trans_id}) with amount ${stmt.amount}`);
      
      const linkedInvIds = transToInvoiceIdsMap[stmt.trans_id] || [];
      console.log(`[Buyer Page] Statement ${stmt.id} linked to invoices:`, linkedInvIds);
      
      if (linkedInvIds.length === 0) {
        console.log(`[Buyer Page] No linked invoices for statement ${stmt.id}`);
        continue;
      }

      let remainingToAllocate = Math.abs(Number(stmt.amount) || 0);
      const invoicePaidForStmt = {};
      for (const invId of linkedInvIds) {
        if (remainingToAllocate <= 0) break;
        const invRemaining = invoiceRemainingMap[invId] || 0;
        if (invRemaining <= 0) continue;
        const toAllocate = Math.min(invRemaining, remainingToAllocate);
        if (toAllocate > 0) {
          invoicePaidForStmt[invId] = toAllocate;
          invoiceRemainingMap[invId] -= toAllocate;
          remainingToAllocate -= toAllocate;
          console.log(`[Buyer Page] Allocated ${toAllocate} to invoice ${invId} from statement ${stmt.id}`);
        }
      }
      // Save to allocation map
      for (const invId of linkedInvIds) {
        const key = `${invId}-${stmt.trans_id}`;
        allocationMap[key] = invoicePaidForStmt[invId] || 0;
        console.log(`[Buyer Page] allocationMap[${key}] = ${allocationMap[key]}`);
      }
    }
    console.log("[Buyer Page] Final allocationMap:", allocationMap);

    // ── 5. Attach linkedStatements and balance_amount to each invoice
    invoices = invoices.map(inv => {
      // Find statements relevant to this invoice
      const linkedStatements = statementRows.filter(stmt => {
        const inLinkedTransIds = parseTransIds(inv.linked_trans_ids).includes(stmt.trans_id);
        const matchesInvoiceNumber = stmt.invoice_number === inv.invoice_number;
        const hasLinkedInvoiceId = parseLinkedPurchaseIds(stmt.linked_purchase_ids).some(token => 
          token.startsWith("IP") && parseInt(token.replace("IP", "")) === inv.id
        );
        return inLinkedTransIds || matchesInvoiceNumber || hasLinkedInvoiceId;
      });

      // Calculate total allocated amount for this invoice
      const totalLinkedAmount = linkedStatements.reduce((sum, stmt) => {
        const key = `${inv.id}-${stmt.trans_id}`;
        return sum + (allocationMap[key] || 0);
      }, 0);

      const balance_amount = Math.max(0, Number(inv.grand_total) - totalLinkedAmount);

      return {
        ...inv,
        linkedStatements,
        balance_amount,
        totalLinkedAmount
      };
    });

    // ── 6. Fetch purchases for this buyer (by customer_id) ──────
    let purchaseRows = [];
    if (customerIdForBuyer) {
      const [pRows] = await conn.execute(
        `SELECT 
           id,
           COALESCE(invoice_date, DATE(created_at)) AS invoice_date,
           invoice_number,
           net_amount,
           client_name
         FROM product_stock_request
         WHERE customer_id = ?
         ORDER BY COALESCE(invoice_date, DATE(created_at)) DESC, id DESC`,
        [customerIdForBuyer]
      );
      purchaseRows = pRows;
    }

    // ── 7. Build derived ledger rows ────────────────────────────
    const derivedLedger = [];

    // Add sales entries
    for (const inv of invoices) {
      const invDate = String(inv.created_date).slice(0, 10);
      derivedLedger.push({
        id: `inv-${inv.id}`,
        entry_date: invDate,
        particulars: `Sales – ${inv.invoice_number}`,
        vch_type: "Sales",
        vch_no: inv.invoice_number,
        debit: Number(inv.grand_total) || 0,
        credit: 0,
        source: "invoice",
      });
    }

    // Add purchase entries
    for (const purch of purchaseRows) {
      const purchDate = purch.invoice_date ? String(purch.invoice_date).slice(0, 10) : null;
      if (!purchDate) continue;

      derivedLedger.push({
        id: `purch-${purch.id}`,
        entry_date: purchDate,
        particulars: `Purchase – ${purch.invoice_number}`,
        vch_type: "Purchase",
        vch_no: purch.invoice_number,
        debit: 0,
        credit: Number(purch.net_amount) || 0,
        source: "purchase",
      });
    }

    // Now add receipt entries for the buyer's invoices
    for (const inv of invoices) {
      console.log(`[Buyer Page] Processing invoice ${inv.id} (${inv.invoice_number}) for receipt entries`);
      
      const relevantTransIds = new Set([
        ...parseTransIds(inv.linked_trans_ids),
        ...statementRows.filter(s => s.invoice_number === inv.invoice_number).map(s => s.trans_id),
        ...statementRows.filter(s => {
          const tokens = parseLinkedPurchaseIds(s.linked_purchase_ids);
          return tokens.includes(`IP${inv.id}`);
        }).map(s => s.trans_id)
      ]);
      
      console.log(`[Buyer Page] Invoice ${inv.id} relevantTransIds:`, [...relevantTransIds]);

      for (const transId of relevantTransIds) {
        const stmt = statementRows.find(s => s.trans_id === transId);
        if (!stmt) {
          console.log(`[Buyer Page] No statement found for transId ${transId}`);
          continue;
        }
        const stmtDate = stmt.date ? String(stmt.date).slice(0, 10) : null;
        if (!stmtDate) {
          console.log(`[Buyer Page] Statement ${stmt.id} has no date`);
          continue;
        }

        const key = `${inv.id}-${transId}`;
        const allocatedAmount = allocationMap[key] || 0;
        console.log(`[Buyer Page] Statement ${stmt.id} (${transId}): allocationMap[${key}] = ${allocatedAmount}`);
        
        if (allocatedAmount <= 0) {
          console.log(`[Buyer Page] Skipping statement ${stmt.id} because allocatedAmount <= 0`);
          continue;
        }

        derivedLedger.push({
          id: `stmt-${transId}-inv-${inv.id}`,
          entry_date: stmtDate,
          particulars: stmt.description
            ? `${stmt.description} (${inv.invoice_number})`
            : `Payment received – ${inv.invoice_number}`,
          vch_type: "Receipt",
          vch_no: String(transId),
          debit: 0,
          credit: allocatedAmount,
          source: "statement",
        });
        console.log(`[Buyer Page] Added receipt entry:`, derivedLedger[derivedLedger.length - 1]);
      }
    }

    // ── 8. Manual ledger entries for this buyer ─────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        entry_date    DATE          NOT NULL,
        particulars   VARCHAR(500)  NOT NULL,
        vch_type      VARCHAR(100)  NOT NULL DEFAULT '',
        vch_no        VARCHAR(100)  NOT NULL DEFAULT '',
        debit         DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        credit        DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        buyer_name    VARCHAR(255)  NULL,
        created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    try {
      await conn.execute("SELECT buyer_name FROM ledger_entries LIMIT 1");
    } catch (_) {
      try { await conn.execute("ALTER TABLE ledger_entries ADD COLUMN buyer_name VARCHAR(255) NULL"); } catch (__) {}
    }

    const [manualRows] = await conn.execute(
      `SELECT id, entry_date, particulars, vch_type, vch_no, debit, credit, created_at
       FROM ledger_entries
       WHERE buyer_name = ?
       ORDER BY entry_date ASC, id ASC`,
      [decodedBuyer]
    );

    // Get only the latest return entry for each invoice (to avoid duplicates)
    const returnEntriesMap = {};
    for (const row of manualRows) {
      if (row.vch_type === 'Return') {
        const invoiceNo = row.vch_no;
        if (!returnEntriesMap[invoiceNo] || new Date(row.created_at) > new Date(returnEntriesMap[invoiceNo].created_at)) {
          returnEntriesMap[invoiceNo] = row;
        }
      }
    }

    const filteredManualRows = manualRows.filter(row => {
      if (row.vch_type === 'Return') {
        return returnEntriesMap[row.vch_no]?.id === row.id;
      }
      return true;
    });

    // ── 9. Merge + sort by date asc ─────────────────────────────
    const combined = [
      ...derivedLedger,
      ...filteredManualRows.map((r) => ({ ...r, source: "manual" })),
    ].sort((a, b) => {
      const da = String(a.entry_date).slice(0, 10);
      const db = String(b.entry_date).slice(0, 10);
      if (da < db) return -1;
      if (da > db) return 1;
      const orderMap = { "Sales": 0, "Purchase": 1, "Receipt": 2 };
      const aOrder = orderMap[a.vch_type] !== undefined ? orderMap[a.vch_type] : 99;
      const bOrder = orderMap[b.vch_type] !== undefined ? orderMap[b.vch_type] : 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return 0;
    });

    ledgerEntries = combined;
  } catch (err) {
    console.error("[buyer invoices page] DB error:", err?.message);
  }

  // Get buyer billing address from first invoice (if available)
  const buyerBillingAddress = invoices.length > 0 ? invoices[0].billing_address : "";

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-6 w-full space-y-6">
      {/* Back button */}
      <Link
        href="/admin-dashboard/invoices"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Buyers
      </Link>

      {/* Buyer heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{decodedBuyer}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} on record
        </p>
      </div>

      {/* Invoice Table */}
      <BuyerInvoiceTable invoices={invoices} buyerName={decodedBuyer} />

      {/* Ledger Table */}
      <BuyerLedgerTable rows={ledgerEntries} buyerName={decodedBuyer} billingAddress={buyerBillingAddress} />
    </div>
  );
}
