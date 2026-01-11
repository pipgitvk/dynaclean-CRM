// app/user-dashboard/quotations/[quoteId]/page.jsx
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import QuotationViewer from "@/components/Quotation/QuotationViewer";

export const dynamic = "force-dynamic"; // ✅ ensures the route is always dynamic

async function getQuotationData(quoteId) {
  const conn = await getDbConnection();

  const [[headerRows]] = await conn.execute(
    "SELECT * FROM quotations_records WHERE quote_number = ?",
    [quoteId]
  );
  const [itemRows] = await conn.execute(
    "SELECT * FROM quotation_items WHERE quote_number = ?",
    [quoteId]
  );

  return { header: headerRows, items: itemRows };
}

export default async function QuotationPage({ params }) {
  // ✅ Await cookies() because it's now asynchronous
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return <p className="p-6 text-red-600">Unauthorized</p>;
  }

  // ✅ JWT verification
  await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

  // ✅ Await params before use
  const resolvedParams = await params;
  const { header, items } = await getQuotationData(resolvedParams.quoteId);

  if (!header) {
    return <p className="p-6 text-red-600">Quote not found</p>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <QuotationViewer header={header} items={items} />
    </div>
  );
}
