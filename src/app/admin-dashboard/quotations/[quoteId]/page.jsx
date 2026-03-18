import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import QuotationViewer from "@/components/Quotation/QuotationViewer";

export const dynamic = "force-dynamic";

async function getQuotationData(quoteId) {
  const conn = await getDbConnection();

  const [[headerRows]] = await conn.execute(
    "SELECT * FROM quotations_records WHERE quote_number = ?",
    [quoteId],
  );
  const [itemRows] = await conn.execute(
    "SELECT * FROM quotation_items WHERE quote_number = ?",
    [quoteId],
  );

  let customerEmail = "";
  let customerPhone = "";
  if (headerRows?.customer_id) {
    const [[cust]] = await conn.execute(
      "SELECT email, phone FROM customers WHERE customer_id = ?",
      [headerRows.customer_id],
    );
    if (cust) {
      customerEmail = cust.email || "";
      customerPhone = cust.phone || "";
    }
  }

  return { header: headerRows, items: itemRows, customerEmail, customerPhone };
}

export default async function QuotationPage({ params }) {
  const { quoteId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return <p className="p-6 text-red-600">Unauthorized</p>;

  await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

  const { header, items, customerEmail, customerPhone } = await getQuotationData(quoteId);
  if (!header) return <p className="p-6 text-red-600">Quote not found</p>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <QuotationViewer header={header} items={items} customerEmail={customerEmail} customerPhone={customerPhone} />
    </div>
  );
}
