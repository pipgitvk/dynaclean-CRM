import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET - Fetch pre-bookings for a specific customer
export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customer_id = searchParams.get("customer_id");

    if (!customer_id) {
      return NextResponse.json(
        { error: "customer_id is required" },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    const [bookings] = await connection.execute(
      `SELECT id, product_name, quantity, expected_date, created_at 
       FROM pre_booking 
       WHERE customer_id = ?
       ORDER BY created_at DESC`,
      [customer_id]
    );

    return NextResponse.json({
      success: true,
      bookings: bookings || [],
      totalCount: bookings?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching pre-bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch pre-bookings" },
      { status: 500 }
    );
  }
}
