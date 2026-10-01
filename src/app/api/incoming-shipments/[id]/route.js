import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

const cleanValue = (v) => (v === undefined ? null : v);

// GET - Fetch a single shipment
export async function GET(req, context) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { params } = await context;
    const { id } = await params;
    const conn = await getDbConnection();

    const [shipment] = await conn.execute(
      `SELECT * FROM incoming_shipments WHERE id = ?`,
      [id]
    );

    if (shipment.length === 0) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    return NextResponse.json(shipment[0]);
  } catch (error) {
    console.error("Error fetching shipment:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Update a shipment
export async function PATCH(req, context) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { params } = await context;
    const { id } = await params;
    const updates = await req.json();

    // Validate at least one update field
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Check if shipment exists
    const [existing] = await conn.execute(
      `SELECT * FROM incoming_shipments WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // Build dynamic update query
    const allowedFields = [
      'product_code',
      'item_name',
      'qty',
      'supplier_name',
      'transporter_name',
      'expected_arrival_date',
      'status',
      'notes'
    ];

    const updateFields = [];
    const updateValues = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        updateValues.push(cleanValue(value));
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updateValues.push(cleanValue(payload.username) || 'Unknown');
    updateValues.push(id);

    const query = `UPDATE incoming_shipments SET ${updateFields.join(', ')}, updated_by = ?, updated_at = NOW() WHERE id = ?`;

    await conn.execute(query, updateValues);

    return NextResponse.json({
      success: true,
      message: "Shipment updated successfully"
    });

  } catch (error) {
    console.error("Error updating shipment:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete a shipment
export async function DELETE(req, context) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { params } = await context;
    const { id } = await params;
    const conn = await getDbConnection();

    // Check if shipment exists
    const [existing] = await conn.execute(
      `SELECT * FROM incoming_shipments WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // Delete the shipment
    await conn.execute(
      `DELETE FROM incoming_shipments WHERE id = ?`,
      [id]
    );

    return NextResponse.json({
      success: true,
      message: "Shipment deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting shipment:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
