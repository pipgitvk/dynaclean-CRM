// app/api/quotations/[quoteId]/route.js
import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

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

export async function PUT(req, { params }) {
  // Superadmin-only: verify role from JWT
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET),
    );
    if (payload.role !== "SUPERADMIN") {
      return Response.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
  } catch {
    return Response.json({ success: false, message: "Invalid token" }, { status: 401 });
  }

  const { quoteId } = await params;
  if (!quoteId) {
    return Response.json({ success: false, message: "Missing quote number" }, { status: 400 });
  }

  const conn = await getDbConnection();
  try {
    const body = await req.json();
    const {
      company,
      company_location,
      gstin_no,
      state_name,
      ship_to,
      customer_id,
      terms,
      payment_term_days,
      items,
      subtotal,
      cgst,
      sgst,
      igst,
      round_off,
      grand_total,
      cgstRate,
      sgstRate,
      igstRate,
      quote_date,
    } = body;

    // Update header
    await conn.execute(
      `UPDATE quotations_records SET
        quote_date = ?,
        customer_id = ?,
        company_name = ?,
        company_address = ?,
        state = ?,
        gstin = ?,
        ship_to = ?,
        qty = ?,
        gst = ?,
        cgst_rate = ?,
        sgst_rate = ?,
        igst_rate = ?,
        subtotal = ?,
        round_off = ?,
        grand_total = ?,
        term_con = ?,
        payment_term_days = ?
      WHERE quote_number = ?`,
      [
        quote_date,
        customer_id,
        company,
        company_location,
        state_name,
        gstin_no,
        ship_to,
        items.length,
        (cgst || 0) + (sgst || 0) + (igst || 0),
        cgstRate || 0,
        sgstRate || 0,
        igstRate || 0,
        subtotal,
        round_off || 0,
        grand_total,
        terms,
        payment_term_days,
        quoteId,
      ],
    );

    // Delete old items and re-insert updated ones
    await conn.execute("DELETE FROM quotation_items WHERE quote_number = ?", [quoteId]);

    for (const item of items) {
      const taxable = (item.quantity || 0) * (item.price || 0);
      const gstAmt = taxable * ((item.gst || 0) / 100);
      const total = taxable + gstAmt;

      const isInterstate = igstRate > 0;
      const cgstAmt = isInterstate ? 0 : gstAmt / 2;
      const sgstAmt = isInterstate ? 0 : gstAmt / 2;
      const igstAmt = isInterstate ? gstAmt : 0;

      await conn.execute(
        `INSERT INTO quotation_items
          (quote_number, item_code, item_name, hsn_sac, specification, quantity, unit,
           price_per_unit, taxable_price, total_taxable_amt, gst, total_price,
           cgsttax, cgsttxamt, sgsttax, sgstxamt, igsttax, igsttamt, img_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          quoteId,
          item.productCode || item.item_code || "",
          item.name || item.item_name || "",
          item.hsn || item.hsn_sac || "",
          item.specification || "",
          item.quantity || 0,
          item.unit || "",
          item.price || item.price_per_unit || 0,
          taxable,
          taxable,
          item.gst || 0,
          total,
          isInterstate ? 0 : (item.gst || 0) / 2,
          cgstAmt,
          isInterstate ? 0 : (item.gst || 0) / 2,
          sgstAmt,
          isInterstate ? item.gst || 0 : 0,
          igstAmt,
          item.imageUrl || item.img_url || "",
        ],
      );
    }

    return Response.json({ success: true, message: "Quotation updated successfully" });
  } catch (err) {
    console.error("Quotation update error:", err);
    return Response.json({ success: false, message: "Server error: " + err.message }, { status: 500 });
  }
}
