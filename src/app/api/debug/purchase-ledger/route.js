import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const buyerName = searchParams.get("buyer") || "Indian Air Force";
  const trimmedBuyer = buyerName.trim();

  try {
    const conn = await getDbConnection();

    // 1. Invoices with TRIM match
    const [invTrimRows] = await conn.execute(
      `SELECT id, invoice_number, customer_name, customer_id FROM invoices WHERE TRIM(customer_name) = ? LIMIT 5`,
      [trimmedBuyer]
    );

    // 2. customer_id from invoice
    const customerIdFromInvoice = invTrimRows.length > 0 ? invTrimRows[0].customer_id : null;

    // 3. Purchases by that customer_id directly
    let purchByCustomerId = [];
    if (customerIdFromInvoice) {
      const [r] = await conn.execute(
        `SELECT id, invoice_number, customer_id, client_name, net_amount, invoice_date 
         FROM product_stock_request WHERE customer_id = ? LIMIT 10`,
        [customerIdFromInvoice]
      );
      purchByCustomerId = r;
    }

    // 4. Raw check — what does the page.jsx actually do step by step
    const decodedBuyer = trimmedBuyer;
    let customerIdForBuyer = invTrimRows.length > 0 ? invTrimRows[0].customer_id : null;

    return NextResponse.json({
      input_buyerName: buyerName,
      trimmedBuyer,
      invoicesFound: invTrimRows,
      customerIdFromInvoice,
      purchasesByCustomerId: purchByCustomerId,
      // What page.jsx will use:
      page_decodedBuyer: decodedBuyer,
      page_customerIdForBuyer: customerIdForBuyer,
      page_customerIdType: typeof customerIdForBuyer,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
