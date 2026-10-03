import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import CustomerQuotationsTable from "@/app/admin-dashboard/view-customer/[customerId]/quotations/CustomerQuotationsTable";

export const dynamic = "force-dynamic";

export default async function CustomerQuotationsPage({ params }) {
  const { customerId } = await params;

  const payload = await getSessionPayload();
  const username = payload?.username || "";
  const role = payload?.role || "";

  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    `SELECT customer_id, first_name, last_name, company FROM customers WHERE customer_id = ? LIMIT 1`,
    [customerId]
  );
  const customer = rows[0];
  if (!customer) notFound();

  const displayName =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
    customer.company ||
    `Customer #${customerId}`;

  return (
    <div className="mx-auto px-4 py-8 text-gray-700">
      <Link
        href={`/user-dashboard/view-customer/${customerId}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-4"
      >
        ← Back to {displayName}
      </Link>

      <h1 className="text-2xl font-semibold mb-1">All Quotations</h1>
      <p className="text-sm text-gray-500 mb-6">
        {displayName} · Customer ID: {customerId}
      </p>

      <CustomerQuotationsTable
        customerId={customerId}
        customerName={displayName}
        username={username}
        role={role}
      />
    </div>
  );
}
