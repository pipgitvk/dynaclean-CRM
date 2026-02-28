import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  let conn;
  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId is required" },
        { status: 400 }
      );
    }

    conn = await getDbConnection();

    // Get quote_number for this order (needed for dispatch table)
    const [orderRows] = await conn.execute(
      "SELECT order_id, quote_number FROM neworder WHERE order_id = ?",
      [orderId]
    );

    if (!orderRows || orderRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    const quoteNumber = orderRows[0].quote_number;

    // Delete in correct order (child tables first)
    // 1. order_return_items (references order_id)
    try {
      await conn.execute("DELETE FROM order_return_items WHERE order_id = ?", [
        orderId,
      ]);
    } catch (_) {
      // Table might not exist
    }

    // 2. dispatch (references quote_number from neworder)
    if (quoteNumber) {
      await conn.execute("DELETE FROM dispatch WHERE quote_number = ?", [
        quoteNumber,
      ]);
    }

    // 3. neworder (main table)
    const [result] = await conn.execute(
      "DELETE FROM neworder WHERE order_id = ?",
      [orderId]
    );

    const affected = result?.affectedRows ?? 0;
    if (affected === 0) {
      return NextResponse.json(
        { success: false, error: "Order could not be deleted" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Order deleted permanently from database",
    });
  } catch (error) {
    console.error("Error in delete-order API:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
