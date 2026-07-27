import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { companyName } = await params;
  return { title: `Ledger – ${decodeURIComponent(companyName)} | DynaClean CRM` };
}

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

const fmt = (n) => {
  const num = Number(n) || 0;
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default async function LedgerPage({ params }) {
  const { companyName } = await params;
  const decodedCompany = decodeURIComponent(companyName).trim();

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
  let customerIdForCompany = null;

  try {
    const conn = await getDbConnection();

    // ── 1. Invoices for this company ──────────────────────────────
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
       WHERE TRIM(customer_name) = ?
       ORDER BY COALESCE(order_date, invoice_date) DESC, id DESC`,
      [decodedCompany]
    );
    invoices = invRows;

    if (invoices.length > 0 && invoices[0].customer_id) {
      customerIdForCompany = invoices[0].customer_id;
    }

    // ── 2. Collect all relevant statements for this company ──────
    const buyerInvoiceIds = new Set(invoices.map(i => i.id));
    const buyerInvoiceNumbers = new Set(invoices.map(i => i.invoice_number).filter(Boolean));

    // Fetch all statements
    const [allStatements] = await conn.execute(
      `SELECT id, trans_id, date, amount, description, type, linked_purchase_ids, invoice_number, invoice_status
       FROM statements
       ORDER BY date ASC, id ASC`
    );

    // Filter statements relevant to this company
    let statementRows = allStatements.filter(stmt => {
      const inLinkedTransIds = invoices.some(inv => {
        const invLinkedTransIds = parseTransIds(inv.linked_trans_ids);
        return invLinkedTransIds.includes(stmt.trans_id);
      });
      const matchesInvoiceNumber = stmt.invoice_number && buyerInvoiceNumbers.has(stmt.invoice_number);
      const linkedPurchaseTokens = parseLinkedPurchaseIds(stmt.linked_purchase_ids);
      const hasLinkedInvoiceId = linkedPurchaseTokens.some(token => {
        if (token.startsWith("IP")) {
          const invId = parseInt(token.replace("IP", ""));
          return buyerInvoiceIds.has(invId);
        }
        return false;
      });
      return inLinkedTransIds || matchesInvoiceNumber || hasLinkedInvoiceId;
    });

    // ── 3. Fetch ALL invoices linked to these statements
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
      invoices.forEach(inv => {
        allLinkedInvoiceIds.add(inv.id);
        if (inv.invoice_number) allLinkedInvoiceNumbers.add(inv.invoice_number);
      });

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

    const transToInvoiceIdsMap = {};
    for (const stmt of statementRows) {
      const allIdsInOrder = [];
      const seenIds = new Set();
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
      if (stmt.invoice_number && invoiceNumberToIdMap[stmt.invoice_number]) {
        const invId = invoiceNumberToIdMap[stmt.invoice_number];
        if (!seenIds.has(invId)) {
          allIdsInOrder.push(invId);
          seenIds.add(invId);
        }
      }
      const buyerIds = [];
      const otherIds = [];
      for (const invId of allIdsInOrder) {
        if (buyerInvoiceIds.has(invId)) {
          buyerIds.push(invId);
        } else {
          otherIds.push(invId);
        }
      }
      transToInvoiceIdsMap[stmt.trans_id] = [...buyerIds, ...otherIds];
    }

    const allocationMap = {};
    const invoiceRemainingMap = {};
    for (const invId in invoiceMap) {
      invoiceRemainingMap[invId] = Number(invoiceMap[invId].grand_total) || 0;
    }

    for (const stmt of statementRows) {
      const linkedInvIds = transToInvoiceIdsMap[stmt.trans_id] || [];
      if (linkedInvIds.length === 0) continue;

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
        }
      }
      for (const invId of linkedInvIds) {
        const key = `${invId}-${stmt.trans_id}`;
        allocationMap[key] = invoicePaidForStmt[invId] || 0;
      }
    }

    // ── 5. Build ledger entries ────────────────────────────
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

    // Add receipt entries
    for (const inv of invoices) {
      const relevantTransIds = new Set([
        ...parseTransIds(inv.linked_trans_ids),
        ...statementRows.filter(s => s.invoice_number === inv.invoice_number).map(s => s.trans_id),
        ...statementRows.filter(s => {
          const tokens = parseLinkedPurchaseIds(s.linked_purchase_ids);
          return tokens.includes(`IP${inv.id}`);
        }).map(s => s.trans_id)
      ]);

      for (const transId of relevantTransIds) {
        const stmt = statementRows.find(s => s.trans_id === transId);
        if (!stmt) continue;
        const stmtDate = stmt.date ? String(stmt.date).slice(0, 10) : null;
        if (!stmtDate) continue;

        const key = `${inv.id}-${transId}`;
        const allocatedAmount = allocationMap[key] || 0;
        
        if (allocatedAmount <= 0) continue;

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
      }
    }

    // ── 6. Manual ledger entries
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

    const [manualRows] = await conn.execute(
      `SELECT id, entry_date, particulars, vch_type, vch_no, debit, credit, created_at
       FROM ledger_entries
       WHERE buyer_name = ?
       ORDER BY entry_date ASC, id ASC`,
      [decodedCompany]
    );

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

    // ── 7. Merge + sort by date
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
    console.error("[ledger page] DB error:", err?.message);
  }

  // Calculate totals
  let totalDebit = 0;
  let totalCredit = 0;
  for (const entry of ledgerEntries) {
    totalDebit += Number(entry.debit) || 0;
    totalCredit += Number(entry.credit) || 0;
  }
  const netBalance = totalDebit - totalCredit;

  return (
    <div className="max-w-7xl mx-auto p-6 w-full space-y-6">
      {/* Back button */}
      <Link
        href="/admin-dashboard/ledger"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Ledger Search
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{decodedCompany}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {customerIdForCompany && <span className="font-medium">ID: {customerIdForCompany}</span>} • {ledgerEntries.length} ledger entries on record
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">TOTAL DEBIT</p>
          <p className="text-2xl font-bold text-red-600">₹{fmt(totalDebit)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">TOTAL CREDIT</p>
          <p className="text-2xl font-bold text-green-600">₹{fmt(totalCredit)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">NET BALANCE</p>
          <p className={`text-2xl font-bold ${netBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            ₹{fmt(Math.abs(netBalance))} {netBalance > 0 ? '(Dr)' : '(Cr)'}
          </p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Particulars</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Vch Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Vch No</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Debit (₹)</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Credit (₹)</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    No ledger entries found
                  </td>
                </tr>
              ) : (
                ledgerEntries.map((entry, idx) => (
                  <tr key={entry.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-gray-800">{String(entry.entry_date).slice(0, 10)}</td>
                    <td className="px-4 py-3 text-gray-800">{entry.particulars}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        entry.vch_type === 'Sales' ? 'bg-purple-100 text-purple-800' :
                        entry.vch_type === 'Receipt' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {entry.vch_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800">{entry.vch_no}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      {Number(entry.debit) > 0 ? `₹${fmt(entry.debit)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">
                      {Number(entry.credit) > 0 ? `₹${fmt(entry.credit)}` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
