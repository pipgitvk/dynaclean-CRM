import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import BuyerInvoiceTable from "./BuyerInvoiceTable";
import BuyerLedgerTable from "./BuyerLedgerTable";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buildLedgerForParty } from "@/lib/partyLedger";
import { getDbConnection } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { buyerName } = await params;
  return {
    title: `Invoices – ${decodeURIComponent(buyerName)} | DynaClean CRM`,
  };
}

export default async function BuyerInvoicesPage({ params, searchParams }) {
  const { buyerName } = await params;
  const decodedBuyer = decodeURIComponent(buyerName).trim();
  const sp = await searchParams;
  const customerIdParam =
    sp?.customer_id != null ? String(sp.customer_id).trim() : null;

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
  let customerIdForBuyer = customerIdParam;
  let loadError = null;

  try {
    let resolvedCustomerId = customerIdParam;
    if (!resolvedCustomerId) {
    const conn = await getDbConnection();
      const [cidRows] = await conn.execute(
        `SELECT customer_id FROM customers
         WHERE LOWER(TRIM(COALESCE(company, ''))) = LOWER(?)
            OR LOWER(TRIM(CONCAT_WS(' ', first_name, last_name))) = LOWER(?)
            OR LOWER(TRIM(COALESCE(first_name, ''))) = LOWER(?)
         LIMIT 1`,
        [decodedBuyer, decodedBuyer, decodedBuyer],
      );
      const cid = cidRows[0]?.customer_id;
      if (cid != null && String(cid).trim() !== "" && String(cid) !== "0") {
        resolvedCustomerId = String(cid).trim();
      }
    }

    const result = await buildLedgerForParty(decodedBuyer, resolvedCustomerId);
    ledgerEntries = result.entries || [];
    invoices = result.invoices || [];
    customerIdForBuyer = result.customerId || resolvedCustomerId;
  } catch (err) {
    console.error("[buyer invoices page]", err?.message);
    loadError = err?.message || "Failed to load buyer data";
  }

  const buyerBillingAddress =
    invoices.length > 0 ? invoices[0].billing_address : "";

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-6 w-full space-y-6">
      <Link
        href="/admin-dashboard/invoices"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Buyers
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-800">{decodedBuyer}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {customerIdForBuyer && (
            <span className="font-medium">ID: {customerIdForBuyer}</span>
          )}
          {customerIdForBuyer ? " • " : ""}
          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} on record
        </p>
        {loadError && (
          <p className="text-sm text-red-600 mt-2">{loadError}</p>
        )}
      </div>

      <BuyerInvoiceTable invoices={invoices} buyerName={decodedBuyer} />

      <BuyerLedgerTable
        rows={ledgerEntries}
        buyerName={decodedBuyer}
        billingAddress={buyerBillingAddress}
      />
    </div>
  );
}
