import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET - Fetch pre-bookings for a specific product with customer details
export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const product_name = searchParams.get("product_name");
    const item_code = searchParams.get("item_code");

    if (!product_name && !item_code) {
      return NextResponse.json(
        { error: "Either product_name or item_code is required" },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    let query = `
      SELECT 
        pb.id,
        pb.customer_id,
        pb.product_name,
        pb.item_code,
        pb.quantity,
        pb.expected_date,
        pb.status,
        pb.created_at,
        c.first_name,
        c.last_name,
        c.company,
        c.phone,
        c.email
      FROM pre_booking pb
      LEFT JOIN customers c ON pb.customer_id = c.customer_id
      WHERE 1=1
    `;
    
    const params = [];

    if (product_name) {
      query += " AND (pb.product_name LIKE ? OR c.first_name LIKE ?)";
      params.push(`%${product_name}%`, `%${product_name}%`);
    } else if (item_code) {
      query += " AND pb.item_code = ?";
      params.push(item_code);
    }

    query += " ORDER BY pb.created_at DESC";

    const [bookings] = await connection.execute(query, params);

    // Format the response data
    const formattedBookings = bookings.map(booking => ({
      id: booking.id,
      customer_id: booking.customer_id,
      customer_name: `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || 'N/A',
      company: booking.company || 'N/A',
      phone: booking.phone || 'N/A',
      email: booking.email || 'N/A',
      product_name: booking.product_name,
      item_code: booking.item_code,
      quantity: booking.quantity || 1,
      expected_date: booking.expected_date,
      status: booking.status,
      created_at: booking.created_at
    }));

    return NextResponse.json({
      success: true,
      bookings: formattedBookings,
      totalCount: formattedBookings.length,
    });
  } catch (error) {
    console.error("Error fetching pre-bookings by product:", error);
    return NextResponse.json(
      { error: "Failed to fetch pre-bookings" },
      { status: 500 }
    );
  }
}