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

export default async function BuyerInvoicesPage({ params }) {
  const { buyerName } = await params;
  const decodedBuyer = decodeURIComponent(buyerName);

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
         DATE(created_at) AS created_date,
         created_at
       FROM invoices
       WHERE customer_name = ?
       ORDER BY COALESCE(order_date, invoice_date) DESC, id DESC`,
      [decodedBuyer]
    );
    invoices = invRows;

    // ── 2. Collect all linked trans IDs from every invoice ──────
    const allTransIds = [];
    for (const inv of invoices) {
      const ids = parseTransIds(inv.linked_trans_ids);
      for (const tid of ids) {
        if (!allTransIds.includes(tid)) allTransIds.push(tid);
      }
    }

    // ── 3. Fetch statement rows for those trans IDs ─────────────
    let statementRows = [];
    if (allTransIds.length > 0) {
      const placeholders = allTransIds.map(() => "?").join(",");
      const [stRows] = await conn.execute(
        `SELECT trans_id, date, amount, description, type
         FROM statements
         WHERE trans_id IN (${placeholders})
         ORDER BY date ASC, id ASC`,
        allTransIds
      );
      statementRows = stRows;
    }

    // ── 4. Build derived ledger rows ────────────────────────────
    const derivedLedger = [];

    // Map trans_id → invoice_number for receipt label
    const transToInvoice = {};
    for (const inv of invoices) {
      const ids = parseTransIds(inv.linked_trans_ids);
      for (const tid of ids) transToInvoice[tid] = inv.invoice_number;
    }

    for (const inv of invoices) {
      // Use SQL DATE(created_at) — guaranteed YYYY-MM-DD string from DB
      const invDate = String(inv.created_date).slice(0, 10);

      // Sales entry — Debit (amount owed by buyer)
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

    for (const stmt of statementRows) {
      const stmtDate = stmt.date ? String(stmt.date).slice(0, 10) : null;
      if (!stmtDate) continue;

      const invNo = transToInvoice[String(stmt.trans_id)] || "";
      derivedLedger.push({
        id: `stmt-${stmt.trans_id}`,
        entry_date: stmtDate,
        particulars: stmt.description
          ? `${stmt.description}${invNo ? ` (${invNo})` : ""}`
          : `Payment received${invNo ? ` – ${invNo}` : ""}`,
        vch_type: "Receipt",
        vch_no: String(stmt.trans_id),
        debit: 0,
        credit: Math.abs(Number(stmt.amount) || 0),
        source: "statement",
      });
    }

    // ── 5. Manual ledger entries for this buyer ─────────────────
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

    // ── 6. Merge + sort by date asc ─────────────────────────────
    const combined = [
      ...derivedLedger,
      ...manualRows.map((r) => ({ ...r, source: "manual" })),
    ].sort((a, b) => {
      const da = String(a.entry_date).slice(0, 10);
      const db = String(b.entry_date).slice(0, 10);
      if (da < db) return -1;
      if (da > db) return 1;
      // Sales before Receipt on same date
      if (a.vch_type === "Sales" && b.vch_type !== "Sales") return -1;
      if (b.vch_type === "Sales" && a.vch_type !== "Sales") return 1;
      return 0;
    });

    ledgerEntries = combined;
  } catch (err) {
    console.error("[buyer invoices page] DB error:", err?.message);
  }

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
      <BuyerLedgerTable rows={ledgerEntries} buyerName={decodedBuyer} />
    </div>
  );
}
