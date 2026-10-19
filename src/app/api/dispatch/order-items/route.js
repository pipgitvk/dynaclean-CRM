import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { fetchOrderDispatchLineOptions } from "@/lib/dispatchPartialSelection";
import { canMutateDispatchRole } from "@/lib/roleKeyUtils";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canMutateDispatchRole(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const orderId = new URL(req.url).searchParams.get("order_id");
    if (!orderId) {
      return NextResponse.json({ error: "order_id required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const { quoteNumber, lines } = await fetchOrderDispatchLineOptions(
      conn,
      orderId,
    );

    return NextResponse.json({
      success: true,
      order_id: orderId,
      quote_number: quoteNumber,
      lines,
    });
  } catch (e) {
    console.error("dispatch/order-items:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to load items" },
      { status: 500 },
    );
  }
}
