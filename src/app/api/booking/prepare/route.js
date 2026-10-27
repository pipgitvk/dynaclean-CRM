import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { applyBookingItemSelection } from "@/lib/orderBookingBatches";
import { isBookingAllowedForOrder } from "@/lib/orderBookingEligibility";
import { isFollowUpBookingOrder } from "@/lib/dispatchPartialSelection";

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const orderId = body?.order_id;
    const items = Array.isArray(body?.items) ? body.items : [];
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

    if (Number(order.dispatch_status) === 1) {
      return NextResponse.json(
        { error: "Cannot prepare booking after full dispatch." },
        { status: 403 },
      );
    }

    const followUp = await isFollowUpBookingOrder(conn, orderId);
    if (!isBookingAllowedForOrder(order) && !followUp) {
      return NextResponse.json(
        { error: "Booking not available for this order" },
        { status: 403 },
      );
    }

    const result = await applyBookingItemSelection(conn, orderId, items);

    return NextResponse.json({
      success: true,
      is_partial: result.isPartial,
      quote_number: result.quoteNumber,
    });
  } catch (e) {
    console.error("booking/prepare:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to prepare booking" },
      { status: 400 },
    );
  }
}
