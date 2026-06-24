/**
 * Quick debug endpoint to set delivery_date to today for testing
 * POST /api/debug/update-delivery-date
 * Body: { order_id: "20260623002" }
 */

import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Get today's date
    const today = new Date().toISOString().split("T")[0];

    // Update delivery_date to today
    await conn.execute(
      `UPDATE neworder SET delivery_date = ? WHERE order_id = ?`,
      [today, order_id]
    );

    // Fetch updated order
    const [rows] = await conn.execute(
      `SELECT order_id, delivery_date, quote_number, client_name, email FROM neworder WHERE order_id = ?`,
      [order_id]
    );

    return NextResponse.json({
      success: true,
      message: "Delivery date updated to today",
      order: rows[0],
      today,
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
