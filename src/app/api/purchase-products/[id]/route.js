import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";

export const dynamic = "force-dynamic";

// PATCH - Update purchase product
export async function PATCH(req, { params }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    // Fix: await params (Next.js 15 requirement)
    const { id } = await params;
    const body = await req.json();

    const {
      invoice_no,
      vendor_name,
      product_name,
      product_code,
      amount,
      status,
      purchase_date,
      reference_no,
      quantity,
      unit_price,
      gst_amount,
      notes,
      payment_entries,
      terms_id,
      delivery_location,
      mode_of_transport,
      transportation_charges,
      self_name,
      courier_tracking_id,
      courier_company,
      porter_tracking_id,
      porter_contact,
      truck_number,
      driver_name,
      driver_number,
      // Customer details
      customer_id,
      client_name,
      client_company_name,
      client_number,
      client_email,
      client_gstin,
      customer_address,
      // Document uploads
      eway_bill,
      product_image,
      invoice_upload,
      payment_proof_upload,
      quotation_upload,
    } = body;

    if (!invoice_no || !vendor_name || !product_name || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    const [result] = await conn.execute(
      `UPDATE product_stock_request
       SET
         invoice_number = ?,
         from_company = ?,
         product_name = ?,
         product_code = ?,
         net_amount = ?,
         status = ?,
         invoice_date = ?,
         quantity = ?,
         price_per_unit = ?,
         tax_amount = ?,
         customer_id = ?,
         client_name = ?,
         client_company_name = ?,
         client_number = ?,
         client_email = ?,
         client_gstin = ?,
         customer_address = ?,
         payment_entries = ?,
         terms_id = ?,
         delivery_location = ?,
         mode_of_transport = ?,
         transportation_charges = ?,
         self_name = ?,
         courier_tracking_id = ?,
         courier_company = ?,
         porter_tracking_id = ?,
         porter_contact = ?,
         truck_number = ?,
         driver_name = ?,
         driver_number = ?,
         eway_bill = COALESCE(?, eway_bill),
         product_image = COALESCE(?, product_image),
         invoice_upload = COALESCE(?, invoice_upload),
         payment_proof_upload = COALESCE(?, payment_proof_upload),
         quotation_upload = COALESCE(?, quotation_upload),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        invoice_no          ?? null,
        client_company_name || vendor_name || null,
        product_name        ?? null,
        product_code        || null,
        amount              ?? null,
        status === 'Paid' ? 'fulfilled' : status === 'Partially Paid' ? 'in_warehouse' : 'requested',
        purchase_date       || null,
        quantity            || null,
        unit_price          || null,
        gst_amount          || null,
        customer_id         || null,
        client_name         || null,
        client_company_name || null,
        client_number       || null,
        client_email        || null,
        client_gstin        || null,
        customer_address    || null,
        payment_entries     || null,
        terms_id            ?? null,
        delivery_location   ?? null,
        mode_of_transport   ?? null,
        transportation_charges ?? null,
        self_name           ?? null,
        courier_tracking_id ?? null,
        courier_company     ?? null,
        porter_tracking_id  ?? null,
        porter_contact      ?? null,
        truck_number        ?? null,
        driver_name         ?? null,
        driver_number       ?? null,
        eway_bill           || null,
        product_image       || null,
        invoice_upload      || null,
        payment_proof_upload|| null,
        quotation_upload    || null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: "Purchase not found" },
        { status: 404 }
      );
    }

    // Fetch updated record
    const [rows] = await conn.execute(
      `SELECT 
        id,
        invoice_number as invoice_no,
        from_company as vendor_name,
        product_name,
        product_code,
        net_amount as amount,
        quantity,
        price_per_unit as unit_price,
        tax_amount as gst_amount,
        invoice_date as purchase_date,
        customer_id,
        client_name,
        client_company_name,
        client_number,
        client_email,
        client_gstin,
        customer_address,
        payment_entries,
        terms_id,
        eway_bill,
        product_image,
        invoice_upload,
        payment_proof_upload,
        quotation_upload,
        delivery_location,
        mode_of_transport,
        transportation_charges,
        self_name,
        courier_tracking_id,
        courier_company,
        porter_tracking_id,
        porter_contact,
        truck_number,
        driver_name,
        driver_number,
        CASE 
          WHEN status = 'fulfilled' THEN 'Paid'
          WHEN status = 'in_warehouse' THEN 'Partially Paid'
          ELSE 'Unpaid'
        END as status,
        created_at,
        updated_at
      FROM product_stock_request WHERE id = ?`,
      [id]
    );

    return NextResponse.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("Error updating purchase product:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete purchase product
export async function DELETE(req, { params }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    // Fix: await params (Next.js 15 requirement)
    const { id } = await params;
    const conn = await getDbConnection();

    const [result] = await conn.execute(
      "DELETE FROM product_stock_request WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: "Purchase not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Purchase deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting purchase product:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
