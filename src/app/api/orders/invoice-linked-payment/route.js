import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { lookupInvoiceLinkedPayment } from "@/lib/invoiceLinkedPaymentLookup";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const invoiceNumber = searchParams.get("invoice_number");
    if (!invoiceNumber || !String(invoiceNumber).trim()) {
      return NextResponse.json(
        { error: "invoice_number is required" },
        { status: 400 },
      );
    }

    const conn = await getDbConnection();
    const result = await lookupInvoiceLinkedPayment(conn, invoiceNumber);

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/orders/invoice-linked-payment error:", err);
    return NextResponse.json(
      { error: "Failed to lookup invoice payment" },
      { status: 500 },
    );
  }
}
