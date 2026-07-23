import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET - Fetch pre-bookings with customer details
export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit")) || 500;

    const connection = await getDbConnection();

    // Fetch pre-bookings with customer details
    const [bookings] = await connection.execute(`
      SELECT
        pb.*,
        c.first_name,
        c.last_name,
        c.lead_source,
        c.company,
        c.phone,
        c.email
      FROM pre_booking pb
      LEFT JOIN customers c ON pb.customer_id = c.customer_id
      ORDER BY pb.created_at DESC
      LIMIT ?
    `, [limit]);

    return NextResponse.json({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error("Error fetching pre-bookings with details:", error);
    return NextResponse.json(
      { error: "Failed to fetch pre-bookings" },
      { status: 500 }
    );
  }
}
