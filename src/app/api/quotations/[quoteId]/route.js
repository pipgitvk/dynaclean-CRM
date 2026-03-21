// app/api/quotations/[quoteId]/route.js
import { getDbConnection } from "@/lib/db";

export async function GET(req, { params }) {
  const { quoteId } = await params;
  const quoteNumber = quoteId;
  if (!quoteNumber) {
    return Response.json(
      { success: false, message: "Missing quote number" },
      { status: 400 },
    );
  }

  const conn = await getDbConnection();

  try {
    const [headerRows] = await conn.execute(
      "SELECT * FROM quotations_records WHERE quote_number = ?",
      [quoteNumber],
    );

    if (!headerRows.length) {
      return Response.json(
        { success: false, message: "Quotation not found" },
        { status: 404 },
      );
    }

    const header = headerRows[0];

    const [customerDetails] = await conn.execute(
      `SELECT first_name, email, phone FROM customers WHERE customer_id = ?`,
      [header.customer_id],
    );

    const cust = customerDetails[0];
    const customerFirstName = cust?.first_name || "";
    const customerPhone = cust?.phone || "";
    const customerEmail = cust?.email || "";

    const [items] = await conn.execute(
      "SELECT * FROM quotation_items WHERE quote_number = ?",
      [quoteNumber],
    );

    // Full payload for QuotationViewer modal
    const response = {
      success: true,
      header,
      items: items ?? [],
      customerEmail,
      customerPhone,
      customerFirstName,
      // Backward compatibility (order forms, upload, etc.)
      quote_number: header.quote_number,
      company_name: header.company_name,
      company_address: header.company_address,
      state: header.state,
      ship_to: header.ship_to,
      gstin: header.gstin,
      payment_term_days: header.payment_term_days,
      client_name: customerFirstName,
      phone: customerPhone,
      email: customerEmail,
      delivery_location: header.delivery_location ?? "",
    };

    return Response.json(response);
  } catch (err) {
    console.error("Quotation fetch error:", err);
    return Response.json(
      { success: false, message: "Server error" },
      { status: 500 },
    );
  }
}
