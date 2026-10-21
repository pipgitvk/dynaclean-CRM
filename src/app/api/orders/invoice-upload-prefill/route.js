import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { lookupOrderUploadPrefill } from "@/lib/orderInvoiceUploadLookup";

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

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/orders/invoice-upload-prefill error:", err);
    return NextResponse.json(
      { error: "Failed to load invoice prefill" },
      { status: 500 },
    );
  }
}
