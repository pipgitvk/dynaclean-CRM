import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { notFound } from "next/navigation";
import CustomerQuotationsTable from "@/components/Quotation/CustomerQuotationsTable";
import { headers } from "next/headers";
import { isDashboardEmbedPage } from "@/lib/dashboardEmbed";

export const dynamic = "force-dynamic";

export default async function CustomerQuotationsPage({ params, searchParams }) {
  const { customerId } = await params;
  const isEmbed = isDashboardEmbedPage(await searchParams, await headers());

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

  const displayName = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim()
    || customer.company
    || `Customer #${customerId}`;

  return (
    <div
      className={
        isEmbed
          ? "mx-auto px-0 py-2 text-gray-700"
          : "mx-auto px-4 py-8 text-gray-700"
      }
    >
      <h1 className="text-2xl font-semibold mb-1">
        All Quotations
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {displayName} · Customer ID: {customerId}
      </p>

      <CustomerQuotationsTable
        customerId={customerId}
        customerName={displayName}
        username={username}
        role={role}
        dashboardBase="admin-dashboard"
      />
    </div>
  );
}
