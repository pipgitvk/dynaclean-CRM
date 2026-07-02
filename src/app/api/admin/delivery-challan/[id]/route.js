import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET;

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    } catch (err) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const conn = await getDbConnection();

    // Fetch delivery challan
    const [challanRows] = await conn.execute(
      "SELECT * FROM delivery_challans WHERE id = ?",
      [id]
    );

    if (challanRows.length === 0) {
      return NextResponse.json({ error: "Delivery challan not found" }, { status: 404 });
    }

    const challan = challanRows[0];

    // Fetch items
    const [itemRows] = await conn.execute(
      "SELECT * FROM delivery_challan_items WHERE delivery_challan_id = ?",
      [id]
    );

    challan.items = itemRows;

    return NextResponse.json({ success: true, data: challan });
  } catch (error) {
    console.error("Error fetching delivery challan:", error);
    return NextResponse.json(
      { error: "Failed to fetch delivery challan" },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));

    const body = await request.json();
    const {
      delivery_challan_for,
      delivery_challan_for_address,
      delivery_challan_for_gstin,
      ship_to,
      ship_to_address,
      ship_to_gstin,
      transportation_details,
      expected_delivery_date,
      delivery_date,
      delivery_location,
      challan_no,
      challan_date,
      eway_bill,
      items,
      remarks,
    } = body;

    const conn = await getDbConnection();

    // Add eway_bill column if it doesn't exist
    try {
      await conn.execute(`ALTER TABLE delivery_challans ADD COLUMN eway_bill VARCHAR(255)`);
    } catch (err) {
      // Column might already exist, ignore error
    }

    // Add delivery_challan_for_address column if it doesn't exist
    try {
      await conn.execute(`ALTER TABLE delivery_challans ADD COLUMN delivery_challan_for_address TEXT`);
    } catch (err) {
      // Column might already exist, ignore error
    }

    // Add ship_to_address column if it doesn't exist
    try {
      await conn.execute(`ALTER TABLE delivery_challans ADD COLUMN ship_to_address TEXT`);
    } catch (err) {
      // Column might already exist, ignore error
    }

    // Add delivery_challan_for_gstin column if it doesn't exist
    try {
      await conn.execute(`ALTER TABLE delivery_challans ADD COLUMN delivery_challan_for_gstin VARCHAR(255)`);
    } catch (err) {
      // Column might already exist, ignore error
    }

    // Add ship_to_gstin column if it doesn't exist
    try {
      await conn.execute(`ALTER TABLE delivery_challans ADD COLUMN ship_to_gstin VARCHAR(255)`);
    } catch (err) {
      // Column might already exist, ignore error
    }

    // Add expected_delivery_date column if it doesn't exist
    try {
      await conn.execute(`ALTER TABLE delivery_challans ADD COLUMN expected_delivery_date DATE`);
    } catch (err) {
      // Column might already exist, ignore error
    }

    // Update delivery challan
    await conn.execute(
      `UPDATE delivery_challans 
        SET delivery_challan_for = ?, delivery_challan_for_address = ?, delivery_challan_for_gstin = ?, ship_to = ?, ship_to_address = ?, ship_to_gstin = ?, transportation_details = ?, 
            expected_delivery_date = ?, delivery_date = ?, delivery_location = ?, challan_no = ?, 
            challan_date = ?, eway_bill = ?, remarks = ?
        WHERE id = ?`,
      [
        delivery_challan_for,
        delivery_challan_for_address,
        delivery_challan_for_gstin,
        ship_to,
        ship_to_address,
        ship_to_gstin,
        transportation_details,
        expected_delivery_date,
        delivery_date,
        delivery_location,
        challan_no,
        challan_date,
        eway_bill,
        remarks,
        id,
      ]
    );

    // Delete existing items
    await conn.execute(
      "DELETE FROM delivery_challan_items WHERE delivery_challan_id = ?",
      [id]
    );

    // Insert updated items
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await conn.execute(
          `INSERT INTO delivery_challan_items 
            (delivery_challan_id, product_code, product_name, product_hsn, product_specification, product_unit, product_price, product_quantity, product_image)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            item.productCode,
            item.name,
            item.hsn,
            item.specification,
            item.unit,
            item.price,
            item.quantity,
            item.imageUrl,
          ]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating delivery challan:", error);
    return NextResponse.json(
      { error: "Failed to update delivery challan" },
      { status: 500 }
    );
  }
}
