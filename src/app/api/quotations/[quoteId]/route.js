// app/api/quotations/[quoteId]/route.js
import { getDbConnection } from "@/lib/db";

export async function GET(req, { params }) {
  const quoteNumber = params.quoteId; // actually quote_number
  if (!quoteNumber) {
    return Response.json({ success: false, message: "Missing quote number" }, { status: 400 });
  }

  const conn =await getDbConnection();

  try {
    const response = { success: true };

        response.quote_number = quoteNumber;

    // Get quotation details from quotations_records table
    const [details] = await conn.execute(
      `SELECT customer_id, company_name, company_address, state, ship_to, gstin, payment_term_days
       FROM quotations_records WHERE quote_number = ?`,
      [quoteNumber]
    );

    if (!details.length) {
      return Response.json({ success: false, message: "Quotation not found" }, { status: 404 });
    }

    const [customerDetails] = await conn.execute(
      `SELECT first_name, email, phone from customers where customer_id = ?`,
      [details[0].customer_id]);

    const data = details[0];
    response.company_name = data.company_name;
    response.company_address = data.company_address;
    response.state = data.state;
    response.ship_to = data.ship_to;
    response.gstin = data.gstin;
    response.payment_term_days = data.payment_term_days;
    response.client_name = data.client_name;
    response.contact = data.contact;
    response.email = data.email;
    response.delivery_location = data.delivery_location;
response.client_name = customerDetails[0]?.first_name || "";
response.phone = customerDetails[0]?.phone || "";
response.email = customerDetails[0]?.email || "";


    // Get quotation items
    const [items] = await conn.execute(
      `SELECT img_url, item_name, item_code, specification, quantity, unit, price_per_unit,
              taxable_price, gst, total_price
       FROM quotation_items WHERE quote_number = ?`,
      [quoteNumber]
    );

    response.items = items ?? [];

    return Response.json(response);
  } catch (err) {
    console.error("Quotation fetch error:", err);
    return Response.json({ success: false, message: "Server error" }, { status: 500 });
  } finally {
        // await conn.end();
  }
}
