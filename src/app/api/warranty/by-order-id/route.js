import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id");

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "order_id is required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // STEP 1: Check if Order exists
    const [orderCheck] = await conn.execute(
      `SELECT * FROM neworder WHERE BINARY order_id = BINARY ?`,
      [orderId]
    );

    if (orderCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: "Order ID does not exist" },
        { status: 404 }
      );
    }

    const order = orderCheck[0];

    // STEP 2: Check cancellation
    if (order.is_cancelled == 1) {
      return NextResponse.json(
        { success: false, error: "Order is cancelled" },
        { status: 400 }
      );
    }

    // STEP 3: Check returned
    if (order.is_returned == 1) {
      return NextResponse.json(
        { success: false, error: "Order is returned" },
        { status: 400 }
      );
    }

    // STEP 4: Check installation done
    if (order.installation_status == 1) {
      return NextResponse.json(
        { success: false, error: "Order installation already completed" },
        { status: 400 }
      );
    }

    // STEP 5: Check if dispatch exists
    const [dispatchCheck] = await conn.execute(
      `SELECT * FROM dispatch 
       WHERE CONVERT(quote_number USING utf8mb3) COLLATE utf8mb3_unicode_ci = ?
       ORDER BY id DESC`,
      [order.quote_number]
    );

    if (dispatchCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: "No dispatched product found for this Order ID" },
        { status: 404 }
      );
    }

    // STEP 6: Check serial number validity
    const hasSerial = dispatchCheck.some(
      (d) => d.serial_no !== null && d.serial_no.trim() !== ""
    );

    if (!hasSerial) {
      return NextResponse.json(
        { success: false, error: "Dispatch found but serial number missing" },
        { status: 400 }
      );
    }

    // STEP 7: MAIN QUERY (only if all conditions pass)
    const [rows] = await conn.execute(
      `SELECT
         d.id AS dispatch_id,
         d.serial_no AS serial_number,
         qi.item_name AS product_name,
         qi.item_code AS model,
         qi.specification AS specification,
         COALESCE(qr.gstin, '') AS gstin,
         COALESCE(no.state, qr.state, '') AS state,
         no.company_name AS customer_name,
         no.email AS email,
         no.client_name AS contact_person,
         no.contact AS contact,
         no.company_address AS customer_address,
         no.invoice_number AS invoice_number,
         no.invoice_date AS invoice_date
       FROM neworder no
       JOIN dispatch d
         ON CONVERT(d.quote_number USING utf8mb3) COLLATE utf8mb3_unicode_ci = no.quote_number
       JOIN quotation_items qi
         ON qi.quote_number = no.quote_number
        AND qi.item_code = CONVERT(d.item_code USING utf8mb3) COLLATE utf8mb3_unicode_ci
       LEFT JOIN quotations_records qr
         ON qr.quote_number = no.quote_number
       LEFT JOIN warranty_products wp
         ON wp.serial_number = CONVERT(d.serial_no USING utf8mb3) COLLATE utf8mb3_unicode_ci
       WHERE BINARY no.order_id = BINARY ?
         AND wp.serial_number IS NULL
       ORDER BY d.id DESC`,
      [orderId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Dispatch found but serial number already registered in warranty",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, dispatches: rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
