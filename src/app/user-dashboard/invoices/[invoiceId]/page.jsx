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

  // Resolve quotation number for reference field (supports both quote_number and internal quotation id)
  let resolvedQuoteNumber = invoice.quotation_id || null;
  let resolvedQuoteCreatedAt = null;
  if (invoice.quotation_id) {
    try {
      const [[byQuoteNumber]] = await conn.execute(
        `
        SELECT quote_number, created_at
        FROM quotations_records
        WHERE TRIM(quote_number) = TRIM(?)
        LIMIT 1
        `,
        [String(invoice.quotation_id)],
      );

      if (byQuoteNumber?.quote_number) {
        resolvedQuoteNumber = byQuoteNumber.quote_number;
        resolvedQuoteCreatedAt = byQuoteNumber.created_at || null;
      } else {
        const [[byLegacyId]] = await conn.execute(
          `
          SELECT quote_number, created_at
          FROM quotations_records
          WHERE TRIM(CAST(\`S.No.\` AS CHAR)) = TRIM(?)
          LIMIT 1
          `,
          [String(invoice.quotation_id)],
        );
        if (byLegacyId?.quote_number) {
          resolvedQuoteNumber = byLegacyId.quote_number;
          resolvedQuoteCreatedAt = byLegacyId.created_at || null;
        }
      }
    } catch {
      // Keep existing quotation_id as fallback if lookup fails
    }
  }

  // If we found the quote number but not the created date, try to resolve it once more.
  if (resolvedQuoteNumber && !resolvedQuoteCreatedAt) {
    try {
      const [[q]] = await conn.execute(
        `
        SELECT created_at
        FROM quotations_records
        WHERE TRIM(quote_number) = TRIM(?)
        LIMIT 1
        `,
        [String(resolvedQuoteNumber)],
      );
      resolvedQuoteCreatedAt = q?.created_at || null;
    } catch {
      // ignore
    }
  }

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
    reference_quote_number: resolvedQuoteNumber,
    reference_quote_created_at: resolvedQuoteCreatedAt,
    items,
  };
}

export default async function InvoicePage({ params }) {
  const { invoiceId } = await params;
  const decodedInvoiceId = decodeURIComponent(invoiceId);

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
  const invoiceData = await getInvoiceWithItems(decodedInvoiceId);

  if (!invoiceData) {
    return <p className="p-6 text-red-600">Invoice not found</p>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <NewInvoice invoice={invoiceData} />
    </div>
  );
}
