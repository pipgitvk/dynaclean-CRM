import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload || !payload.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { order_id, return_booking_date, return_booking_image, return_booking_by } = body;

    if (!order_id) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    if (!return_booking_image) {
      return NextResponse.json({ error: "Return booking image is required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Fetch the order to check its status
    const [orderRows] = await conn.execute(
      "SELECT is_returned, return_booking_done FROM neworder WHERE order_id = ?",
      [order_id]
    );

    if (orderRows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderRows[0];

    // Check if is_returned is 3 (Return Initiated)
    if (Number(order.is_returned) !== 3) {
      return NextResponse.json(
        { error: "Return must be initiated before marking as done" },
        { status: 400 }
      );
    }

    // Check if return_booking_done is already 1
    if (Number(order.return_booking_done) === 1) {
      return NextResponse.json(
        { error: "Return booking is already marked as done" },
        { status: 400 }
      );
    }

    // Update return booking done status — use session username (not frontend value)
    await conn.execute(
      "UPDATE neworder SET return_booking_done = 1, return_booking_date = ?, return_booking_image = ?, return_booking_by = ? WHERE order_id = ?",
      [return_booking_date || new Date(), return_booking_image, payload.username, order_id]
    );

    return NextResponse.json({
      success: true,
      message: "Return booking marked as done successfully",
    });
  } catch (error) {
    console.error("Error marking return booking as done:", error);
    return NextResponse.json(
      { error: "Failed to mark return booking as done" },
      { status: 500 }
    );
  }
}
