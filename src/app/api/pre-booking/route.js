import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// POST - Create a new pre-booking
export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { customer_id, product_name, item_code, quantity, expected_date } = body;

    if (!customer_id || !product_name) {
      return NextResponse.json(
        { error: "customer_id and product_name are required" },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    // Insert pre-booking record
    const [result] = await connection.execute(
      `INSERT INTO pre_booking (customer_id, product_name, item_code, quantity, expected_date, created_by) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [customer_id, product_name, item_code || null, quantity || 1, expected_date || null, payload.username]
    );

    return NextResponse.json({
      success: true,
      message: "Pre-booking created successfully",
      id: result.insertId
    });
  } catch (error) {
    console.error("Error creating pre-booking:", error);
    return NextResponse.json(
      { error: "Failed to create pre-booking" },
      { status: 500 }
    );
  }
}

// GET - Fetch pre-bookings
export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customer_id = searchParams.get("customer_id");
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 50;
    const offset = (page - 1) * limit;

    const connection = await getDbConnection();

    let query = "SELECT * FROM pre_booking WHERE 1=1";
    const params = [];

    if (customer_id) {
      query += " AND customer_id = ?";
      params.push(customer_id);
    }

    // Get total count
    const [countResult] = await connection.execute(
      query.replace("SELECT *", "SELECT COUNT(*) as count"),
      params
    );
    const total = countResult[0].count;

    // Get paginated results
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [bookings] = await connection.execute(query, params);

    return NextResponse.json({
      success: true,
      bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching pre-bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch pre-bookings" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a pre-booking
export async function DELETE(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    await connection.execute(
      `DELETE FROM pre_booking WHERE id = ?`,
      [id]
    );

    return NextResponse.json({
      success: true,
      message: "Pre-booking deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting pre-booking:", error);
    return NextResponse.json(
      { error: "Failed to delete pre-booking" },
      { status: 500 }
    );
  }
}

// PUT - Update pre-booking status
export async function PUT(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400 }
      );
    }

    if (!['pending', 'received'].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'pending' or 'received'" },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    await connection.execute(
      `UPDATE pre_booking SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id]
    );

    return NextResponse.json({
      success: true,
      message: "Pre-booking status updated successfully"
    });
  } catch (error) {
    console.error("Error updating pre-booking status:", error);
    return NextResponse.json(
      { error: "Failed to update pre-booking status" },
      { status: 500 }
    );
  }
}
