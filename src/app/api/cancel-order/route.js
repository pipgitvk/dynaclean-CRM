import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { cancelActiveInvoiceForOrder } from "@/lib/cancelInvoiceForOrder";

export async function POST(req) {
  let dbConnection;
  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ message: "orderId is required" }, { status: 400 });
    }

    dbConnection = await getDbConnection();

    const [orderRows] = await dbConnection.execute(
      `SELECT order_id, quote_number, invoice_number, report_file
       FROM neworder WHERE order_id = ? LIMIT 1`,
      [orderId],
    );
    const order = orderRows?.[0];
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    await dbConnection.execute(
      "UPDATE neworder SET is_cancelled = ? WHERE order_id = ?",
      [1, orderId],
    );

    let invoiceCancel = { cancelled: false };
    try {
      invoiceCancel = await cancelActiveInvoiceForOrder(dbConnection, order);
    } catch (invErr) {
      console.error("[cancel-order] invoice cancel:", invErr);
    }

    return NextResponse.json(
      {
        message: "Order cancelled successfully",
        invoiceCancelled: invoiceCancel.cancelled,
        invoice_number: invoiceCancel.invoice_number || null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in cancel-order API:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
