import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { fetchOrderBookingLineOptions } from "@/lib/orderBookingBatches";
import { isBookingAllowedForOrder } from "@/lib/orderBookingEligibility";
import { isFollowUpBookingOrder } from "@/lib/dispatchPartialSelection";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orderId = new URL(req.url).searchParams.get("order_id");
    if (!orderId) {
      return NextResponse.json({ error: "order_id required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const [orderRows] = await conn.execute(
      `SELECT order_id, report_file, booking_id, dispatch_status
       FROM neworder WHERE order_id = ? LIMIT 1`,
      [orderId],
    );
    const order = orderRows?.[0];
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const followUp = await isFollowUpBookingOrder(conn, orderId);
    if (!isBookingAllowedForOrder(order) && !followUp) {
      return NextResponse.json(
        { error: "Booking not available for this order" },
        { status: 403 },
      );
    }

    const { quoteNumber, lines } = await fetchOrderBookingLineOptions(
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
    console.error("booking/order-items:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to load items" },
      { status: 500 },
    );
  }
}
