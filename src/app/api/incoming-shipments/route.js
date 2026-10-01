import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

const cleanValue = (v) => (v === undefined ? null : v);

// GET - Fetch all incoming shipments
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conn = await getDbConnection();
    const [shipments] = await conn.execute(
      `SELECT * FROM incoming_shipments ORDER BY created_at DESC`
    );

    return NextResponse.json(Array.isArray(shipments) ? shipments : []);
  } catch (error) {
    console.error("Error fetching incoming shipments:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create a new incoming shipment
export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      product_code,
      item_name,
      qty,
      supplier_name,
      transporter_name,
      expected_arrival_date,
      status,
      notes
    } = await req.json();

    // Validate required fields
    if (!supplier_name || !qty || qty <= 0) {
      return NextResponse.json({
        error: "Supplier name and quantity are required, quantity must be positive"
      }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Generate shipment ID
    const shipmentId = `SHIP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const [result] = await conn.execute(
      `INSERT INTO incoming_shipments 
        (shipment_id, product_code, item_name, qty, supplier_name, transporter_name, expected_arrival_date, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shipmentId,
        product_code || null,
        item_name || null,
        qty,
        supplier_name,
        transporter_name || null,
        expected_arrival_date || null,
        status || 'Order Preparing',
        notes || null,
        cleanValue(payload.username) || 'Unknown'
      ]
    );

    return NextResponse.json({
      success: true,
      message: "Shipment created successfully",
      shipmentId: shipmentId,
      id: result.insertId
    }, { status: 201 });

  } catch (error) {
    console.error("Error creating incoming shipment:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
