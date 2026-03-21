// src/app/admin-dashboard/quotations/page.jsx
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import QuotationTableClient from "./QuotationClientTable";

export const dynamic = "force-dynamic";

export default async function QuotationPage({ searchParams }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  let username = "";

  if (token) {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET),
    );
    username = payload.username;
  }

  const sp = await searchParams;
  const customerId = sp?.customer_id ? String(sp.customer_id).trim() : "";

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Quotation Management
        </h1>
        <a
          href="/admin-dashboard/quotations/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          New Quotation
        </a>
      </div>

      {/* Send username to client component */}
      <QuotationTableClient username={username} customerId={customerId} />
    </div>
  );
}
