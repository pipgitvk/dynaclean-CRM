import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import QuotationViewer from "@/components/Quotation/QuotationViewer";

export const dynamic = "force-dynamic";

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

  // await conn.end();
  return { header: headerRows, items: itemRows };
}

export default async function QuotationPage({ params }) {
  const token = cookies().get("token")?.value;
  if (!token) return <p className="p-6 text-red-600">Unauthorized</p>;

  await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

  const { header, items } = await getQuotationData(params.quoteId);
  if (!header) return <p className="p-6 text-red-600">Quote not found</p>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <QuotationViewer header={header} items={items} />
    </div>
  );
}
