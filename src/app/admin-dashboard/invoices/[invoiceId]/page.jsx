import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import NewInvoice from "@/components/invoice/DesignInvoice";

export const dynamic = "force-dynamic";

async function getInvoiceData(invoiceId) {
  const conn = await getDbConnection();

  // 1️⃣ Get quote_number properly
  const [[quoteRow]] = await conn.execute(
    "SELECT quote_number FROM invoices WHERE invoice_number = ?",
    [invoiceId],
  );

  if (!quoteRow) return null;

  const quoteNum = quoteRow.quote_number;

  // 2️⃣ Use quoteNum correctly
  const [[headerRows]] = await conn.execute(
    "SELECT * FROM quotations_records WHERE quote_number = ?",
    [quoteNum],
  );

  const [itemRows] = await conn.execute(
    "SELECT * FROM quotation_items WHERE quote_number = ?",
    [quoteNum],
  );

  const [[invoiceRows]] = await conn.execute(
    "SELECT * FROM invoices WHERE invoice_number = ?",
    [invoiceId],
  );

  return {
    header: headerRows,
    items: itemRows,
    invoice: invoiceRows,
  };
}

export default async function InvoicePage({ params }) {
  const { invoiceId } = await params;
  console.log("Invoice ID:", invoiceId);
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return <p className="p-6 text-red-600">Unauthorized</p>;

  await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

  const { header, items, invoice } = await getInvoiceData(invoiceId);
  if (!header) return <p className="p-6 text-red-600">Invoice not found</p>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <NewInvoice header={header} items={items} invoice={invoice} />
    </div>
  );
}
