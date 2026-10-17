import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { findActiveInvoiceForOrder } from "@/lib/activeInvoiceForOrder";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orderId = String(req.nextUrl.searchParams.get("order_id") || "").trim();
    const quoteNumber = String(
      req.nextUrl.searchParams.get("quotation_number") ||
        req.nextUrl.searchParams.get("quote_number") ||
        "",
    ).trim();

    if (!orderId && !quoteNumber) {
      return NextResponse.json(
        { error: "order_id or quotation_number required" },
        { status: 400 },
      );
    }

    const conn = await getDbConnection();
    let quote = quoteNumber;
    if (!quote && orderId) {
      const [[row]] = await conn.execute(
        "SELECT quote_number FROM neworder WHERE order_id = ? LIMIT 1",
        [orderId],
      );
      quote = String(row?.quote_number || "").trim();
    }

    const inv = await findActiveInvoiceForOrder(conn, {
      order_id: orderId,
      quote_number: quote,
    });

    if (!inv) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      invoice_number: inv.invoice_number,
      invoice_id: inv.id,
    });
  } catch (e) {
    console.error("active-invoice GET:", e);
    return NextResponse.json(
      { error: e.message || "Failed to check invoice" },
      { status: 500 },
    );
  }
}
