import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import LedgerTable from "./LedgerTable";
import LedgerTableClient from "@/app/admin-dashboard/ledger/[companyName]/LedgerTableClient";
import { getDbConnection } from "@/lib/db";
import { buildLedgerForParty } from "@/lib/partyLedger";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";
export const metadata = { title: "Ledger | DynaClean CRM" };

function partyNameFromCustomerRow(c) {
  if (!c) return "";
  const company = String(c.company || "").trim();
  if (company) return company;
  const person = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return person || "";
}

export default async function LedgerPage({ searchParams }) {
  const sp = await searchParams;
  const customerIdParam =
    sp?.customerId != null ? String(sp.customerId).trim() : "";

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return <p className="text-red-600 p-4">Unauthorized</p>;
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
  } catch {
    return <p className="text-red-600 p-4">Invalid Token</p>;
  }

  if (customerIdParam) {
    let partyName = "";
    let ledgerEntries = [];
    let loadError = null;

    try {
      const conn = await getDbConnection();
      const [custRows] = await conn.execute(
        `SELECT customer_id, first_name, last_name, company, address
         FROM customers
         WHERE CAST(customer_id AS CHAR) = ?
         LIMIT 1`,
        [customerIdParam],
      );
      const customer = custRows[0];
      partyName =
        partyNameFromCustomerRow(customer) || `Customer ${customerIdParam}`;

      const result = await buildLedgerForParty(partyName, customerIdParam);
      ledgerEntries = result.entries || [];
    } catch (err) {
      console.error("[accounting ledger party]", err?.message);
      loadError = err?.message || "Failed to load party ledger";
    }

    return (
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 w-full space-y-4">
        <Link
          href={`/admin-dashboard/view-customer/${encodeURIComponent(customerIdParam)}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={15} />
          Back to customer
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-gray-800">{partyName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Customer ID: {customerIdParam}
            {loadError ? (
              <span className="text-red-600 block mt-1">{loadError}</span>
            ) : null}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <LedgerTableClient
            rows={ledgerEntries}
            companyName={partyName}
            customerId={customerIdParam}
          />
        </div>
      </div>
    );
  }

  let rows = [];
  try {
    const conn = await getDbConnection();

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        entry_date    DATE          NOT NULL,
        particulars   VARCHAR(500)  NOT NULL,
        vch_type      VARCHAR(100)  NOT NULL DEFAULT '',
        vch_no        VARCHAR(100)  NOT NULL DEFAULT '',
        debit         DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        credit        DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [result] = await conn.execute(
      `SELECT id, entry_date, particulars, vch_type, vch_no, debit, credit, created_at
       FROM ledger_entries
       ORDER BY entry_date DESC, id DESC`,
    );
    rows = result;
  } catch (err) {
    console.error("[ledger] DB error:", err?.message);
  }

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-6 w-full bg-white text-black">
      <LedgerTable rows={rows} />
    </div>
  );
}
