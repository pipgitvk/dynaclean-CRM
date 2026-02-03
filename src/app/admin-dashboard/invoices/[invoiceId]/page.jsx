import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import NewInvoice from "@/components/invoice/DesignInvoice";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fetch invoice + items
async function getInvoiceWithItems(invoiceNumber) {
  const conn = await getDbConnection();

  // Invoice
  const [[invoice]] = await conn.execute(
    `
    SELECT *
    FROM invoices
    WHERE invoice_number = ?
    LIMIT 1
    `,
    [invoiceNumber],
  );

  if (!invoice) return null;

  // Invoice items (MULTIPLE)
  const [items] = await conn.execute(
    `
    SELECT *
    FROM invoice_items
    WHERE invoice_id = ?
    ORDER BY id ASC
    `,
    [invoice.id],
  );

  return {
    ...invoice,
    items,
  };
}

export default async function InvoicePage({ params }) {
  const { invoiceId } = await params;

  //  Auth check
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return <p className="p-6 text-red-600">Unauthorized</p>;
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
  } catch {
    return <p className="p-6 text-red-600">Invalid token</p>;
  }

  //  Fetch invoice + items
  const invoiceData = await getInvoiceWithItems(invoiceId);

  if (!invoiceData) {
    return <p className="p-6 text-red-600">Invoice not found</p>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <NewInvoice invoice={invoiceData} />
    </div>
  );
}
