import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      order_id,
      return_booking_id: return_booking_ref,  // the booking reference ID (like booking_id)
      return_booking_date,
      expected_pickup_date,
      return_booking_url,
      return_booking_remarks,
      return_booking_by,
    } = body;

    if (!order_id || !return_booking_date || !return_booking_ref) {
      return NextResponse.json(
        { success: false, error: "order_id, return_booking_date and Return Booking ID are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Ensure return booking columns exist on neworder table
    const alterQueries = [
      "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS return_booking_ref VARCHAR(255) NULL",
      "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS return_booking_date DATE NULL",
      "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS return_booking_by VARCHAR(255) NULL",
      "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS return_booking_remarks TEXT NULL",
      "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS expected_pickup_date DATE NULL",
      "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS return_booking_url VARCHAR(500) NULL",
      "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS return_booking_done TINYINT(1) DEFAULT 0",
      "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    ];
    for (const q of alterQueries) {
      await conn.execute(q).catch(() => {});
    }

    let hasUpdatedAt = false;
    try {
      const [cols] = await conn.execute("SHOW COLUMNS FROM neworder LIKE 'updated_at'");
      hasUpdatedAt = Array.isArray(cols) && cols.length > 0;
    } catch {}

    // Check order exists and is in Return Initiated state (is_returned = 3)
    const [orderRows] = await conn.execute(
      "SELECT order_id, is_returned, return_booking_done FROM neworder WHERE order_id = ?",
      [order_id]
    );

    if (!orderRows.length) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const order = orderRows[0];

    if (Number(order.is_returned) !== 3) {
      return NextResponse.json(
        { success: false, error: "Return booking can only be created for orders with 'Return Initiated' status" },
        { status: 400 }
      );
    }

    if (Number(order.return_booking_done) === 1) {
      return NextResponse.json(
        { success: false, error: "Return booking already exists for this order" },
        { status: 400 }
      );
    }

    // Save return booking fields on the order
    const setClauses = [
      "return_booking_ref      = ?",
      "return_booking_date     = ?",
      "expected_pickup_date    = ?",
      "return_booking_url      = ?",
      "return_booking_remarks  = ?",
      "return_booking_by       = ?",
      "return_booking_done     = 1",
      ...(hasUpdatedAt ? ["updated_at              = NOW()"] : []),
    ];

    const [result] = await conn.execute(
      `UPDATE neworder 
       SET ${setClauses.join(",\n           ")}
       WHERE order_id = ?`,
      [
        return_booking_ref,
        return_booking_date,
        expected_pickup_date || null,
        return_booking_url   || null,
        return_booking_remarks || null,
        return_booking_by    || payload.username,
        order_id,
      ]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to create return booking" },
        { status: 500 }
      );
    }

    const [updatedRows] = await conn.execute(
      `SELECT 
         order_id,
         is_returned,
         return_booking_done,
         return_booking_ref,
         return_booking_date,
         expected_pickup_date,
         return_booking_url,
         return_booking_remarks,
         return_booking_by
       FROM neworder
       WHERE order_id = ?`,
      [order_id]
    );

    console.log(`[return-booking] Created for order_id=${order_id}, ref=${return_booking_ref}`);

    revalidatePath("/user-dashboard/order");
    revalidatePath("/admin-dashboard/order");

    return NextResponse.json({
      success: true,
      message: `Return booking created successfully for order ${order_id}`,
      order: updatedRows?.[0] || null,
    });

  } catch (err) {
    console.error("POST /api/orders/return-booking error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
