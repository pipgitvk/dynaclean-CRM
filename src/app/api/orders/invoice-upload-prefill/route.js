import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { lookupOrderUploadPrefill } from "@/lib/orderInvoiceUploadLookup";
import { syncOrderLinkedPaymentFromInvoice } from "@/lib/syncOrderLinkedPaymentFromInvoice";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id");
    if (!orderId || !String(orderId).trim()) {
      return NextResponse.json(
        { error: "order_id is required" },
        { status: 400 },
      );
    }

    const conn = await getDbConnection();
    const result = await lookupOrderUploadPrefill(conn, orderId);

    if (!result.found) {
      const [orderRows] = await conn.execute(
        `SELECT order_id, quote_number, invoice_number, totalamt, amount_received,
                payment_received_date, linked_payments_json, payment_id, payment_date,
                payment_amount, payment_status
         FROM neworder WHERE order_id = ? LIMIT 1`,
        [String(orderId).trim()],
      );
      if (orderRows?.length) {
        await syncOrderLinkedPaymentFromInvoice(conn, orderRows[0]);
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/orders/invoice-upload-prefill error:", err);
    return NextResponse.json(
      { error: "Failed to load invoice prefill" },
      { status: 500 },
    );
  }
}
